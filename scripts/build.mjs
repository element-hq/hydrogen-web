/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import cheerio from "cheerio";
import fsRoot from "fs";
const fs = fsRoot.promises;
import path from "path";
import rollup from 'rollup';
import postcss from "postcss";
import postcssImport from "postcss-import";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// needed for legacy bundle
import babel from '@rollup/plugin-babel';
// needed to find the polyfill modules in the main-legacy.js bundle
import { nodeResolve } from '@rollup/plugin-node-resolve';
// needed because some of the polyfills are written as commonjs modules
import commonjs from '@rollup/plugin-commonjs';
// multi-entry plugin so we can add polyfill file to main
import multi from '@rollup/plugin-multi-entry';

import cssvariables from "postcss-css-variables";
import flexbugsFixes from "postcss-flexbugs-fixes";

const PROJECT_ID = "hydrogen";
const PROJECT_SHORT_NAME = "Hydrogen";
const PROJECT_NAME = "Hydrogen Chat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = path.join(__dirname, "../");
const cssDir = path.join(projectDir, "src/ui/web/css/");
const targetDir = path.join(projectDir, "target");

const {debug, noOffline, legacy} = process.argv.reduce((params, param) => {
    if (param.startsWith("--")) {
        params[param.substr(2)] = true;
    }
    return params;
}, {
    debug: false,
    noOffline: false,
    legacy: false
});
const offline = !noOffline;

async function build() {
    // get version number
    const version = JSON.parse(await fs.readFile(path.join(projectDir, "package.json"), "utf8")).version;
    // clear target dir
    await removeDirIfExists(targetDir);
    await fs.mkdir(targetDir);
    let bundleName = `${PROJECT_ID}.js`;
    if (legacy) {
        bundleName = `${PROJECT_ID}-legacy.js`;
    }


    const devHtml = await fs.readFile(path.join(projectDir, "index.html"), "utf8");
    const doc = cheerio.load(devHtml);
    const themes = [];
    findThemes(doc, themeName => {
        themes.push(themeName);
    });

    // also creates the directories where the theme css bundles are placed in,
    // so do it first
    const themeAssets = await copyThemeAssets(themes, legacy);

    await buildHtml(doc, version, bundleName);
    if (legacy) {
        await buildJsLegacy(bundleName);
    } else {
        await buildJs(bundleName);
    }
    await buildCssBundles(legacy ? buildCssLegacy : buildCss, themes);
    if (offline) {
        await buildOffline(version, bundleName);
    }

    console.log(`built ${PROJECT_ID}${legacy ? " legacy" : ""} ${version} successfully`);
}

async function findThemes(doc, callback) {
    doc("link[rel~=stylesheet][title]").each((i, el) => {
        const theme = doc(el);
        const href = theme.attr("href");
        const themesPrefix = "/themes/";
        const prefixIdx = href.indexOf(themesPrefix);
        if (prefixIdx !== -1) {
            const themeNameStart = prefixIdx + themesPrefix.length;
            const themeNameEnd = href.indexOf("/", themeNameStart);
            const themeName = href.substr(themeNameStart, themeNameEnd - themeNameStart);
            callback(themeName, theme);
        }
    });
}

async function copyThemeAssets(themes, legacy) {
    const assets = [];
    // create theme directories and copy assets
    await fs.mkdir(path.join(targetDir, "themes"));
    for (const theme of themes) {
        assets.push(`themes/${theme}/bundle.css`);
        const themeDstFolder = path.join(targetDir, `themes/${theme}`);
        await fs.mkdir(themeDstFolder);
        const themeSrcFolder = path.join(cssDir, `themes/${theme}`);
        await copyFolder(themeSrcFolder, themeDstFolder, file => {
            const isUnneededFont = legacy ? file.endsWith(".woff2") : file.endsWith(".woff");
            if (!file.endsWith(".css") && !isUnneededFont) {
                assets.push(file.substr(cssDir.length));
                return true;
            }
            return false;
        });
    }
    return assets;
}

async function buildHtml(doc, version, bundleName) {
    // transform html file
    // change path to main.css to css bundle
    doc("link[rel=stylesheet]:not([title])").attr("href", `${PROJECT_ID}.css`);
    // change paths to all theme stylesheets
    findThemes(doc, (themeName, theme) => {
        theme.attr("href", `themes/${themeName}/bundle.css`);
    });
    doc("script#main").replaceWith(
        `<script type="text/javascript" src="${bundleName}"></script>` +
        `<script type="text/javascript">${PROJECT_ID}Bundle.main(document.body);</script>`);
    removeOrEnableScript(doc("script#service-worker"), offline);

    const versionScript = doc("script#version");
    versionScript.attr("type", "text/javascript");
    let vSource = versionScript.contents().text();
    vSource = vSource.replace(`"%%VERSION%%"`, `"${version}"`);
    versionScript.text(vSource);

    if (offline) {
        doc("html").attr("manifest", "manifest.appcache");
        doc("head").append(`<link rel="manifest" href="manifest.json">`);
    }
    await fs.writeFile(path.join(targetDir, "index.html"), doc.html(), "utf8");
}

async function buildJs(bundleName) {
    // create js bundle
    const bundle = await rollup.rollup({input: 'src/main.js'});
    await bundle.write({
        file: path.join(targetDir, bundleName),
        format: 'iife',
        name: `${PROJECT_ID}Bundle`
    });
}

async function buildJsLegacy(bundleName) {
    // compile down to whatever IE 11 needs
    const babelPlugin = babel.babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**',
        presets: [
            [
                "@babel/preset-env",
                {
                    useBuiltIns: "entry",
                    corejs: "3",
                    targets: "IE 11"
                }
            ]
        ]
    });
    // create js bundle
    const rollupConfig = {
        input: ['src/legacy-polyfill.js', 'src/main.js'],
        plugins: [multi(), commonjs(), nodeResolve(), babelPlugin]
    };
    const bundle = await rollup.rollup(rollupConfig);
    await bundle.write({
        file: path.join(targetDir, bundleName),
        format: 'iife',
        name: `${PROJECT_ID}Bundle`
    });
}

async function buildOffline(version, bundleName) {
    // write offline availability
    const offlineFiles = [bundleName, `${PROJECT_ID}.css`, "index.html", "icon-192.png"];

    // write appcache manifest
    const manifestLines = [
        `CACHE MANIFEST`,
        `# v${version}`,
        `NETWORK`,
        `"*"`,
        `CACHE`,
    ];
    manifestLines.push(...offlineFiles);
    const manifest = manifestLines.join("\n") + "\n";
    await fs.writeFile(path.join(targetDir, "manifest.appcache"), manifest, "utf8");
    // write service worker
    let swSource = await fs.readFile(path.join(projectDir, "src/service-worker.template.js"), "utf8");
    swSource = swSource.replace(`"%%VERSION%%"`, `"${version}"`);
    swSource = swSource.replace(`"%%FILES%%"`, JSON.stringify(offlineFiles));
    await fs.writeFile(path.join(targetDir, "sw.js"), swSource, "utf8");
    // write web manifest
    const webManifest = {
        name:PROJECT_NAME,
        short_name: PROJECT_SHORT_NAME,
        display: "fullscreen",
        start_url: "index.html",
        icons: [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"}],
    };
    await fs.writeFile(path.join(targetDir, "manifest.json"), JSON.stringify(webManifest), "utf8");
    // copy icon
    let icon = await fs.readFile(path.join(projectDir, "icon.png"));
    await fs.writeFile(path.join(targetDir, "icon-192.png"), icon);
}

async function buildCssBundles(buildFn, themes) {
    const cssMainFile = path.join(cssDir, "main.css");
    await buildFn(cssMainFile, path.join(targetDir, `${PROJECT_ID}.css`));
    for (const theme of themes) {
        await buildFn(
            path.join(cssDir, `themes/${theme}/theme.css`),
            path.join(targetDir, `themes/${theme}/bundle.css`)
        );
    }
}

async function buildCss(entryPath, bundlePath) {
    const preCss = await fs.readFile(entryPath, "utf8");
    const cssBundler = postcss([postcssImport]);
    const result = await cssBundler.process(preCss, {from: entryPath});
    await fs.writeFile(bundlePath, result.css, "utf8");
}

async function buildCssLegacy(entryPath, bundlePath) {
    const preCss = await fs.readFile(entryPath, "utf8");
    const cssBundler = postcss([postcssImport, cssvariables(), flexbugsFixes()]);
    const result = await cssBundler.process(preCss, {from: entryPath});
    await fs.writeFile(bundlePath, result.css, "utf8");
}

function removeOrEnableScript(scriptNode, enable) {
    if (enable) {
        scriptNode.attr("type", "text/javascript");
    } else {
        scriptNode.remove();
    }
}

async function removeDirIfExists(targetDir) {
    try {
        await fs.rmdir(targetDir, {recursive: true});
    } catch (err) {
        if (err.code !== "ENOENT") {
            throw err;
        }
    }
}

async function copyFolder(srcRoot, dstRoot, filter) {
    const dirEnts = await fs.readdir(srcRoot, {withFileTypes: true});
    for (const dirEnt of dirEnts) {
        const dstPath = path.join(dstRoot, dirEnt.name);
        const srcPath = path.join(srcRoot, dirEnt.name);
        if (dirEnt.isDirectory()) {
            await fs.mkdir(dstPath);
            await copyFolder(srcPath, dstPath, filter);
        } else if (dirEnt.isFile() && filter(srcPath)) {
            await fs.copyFile(srcPath, dstPath);
        }
    }
}

build().catch(err => console.error(err));
