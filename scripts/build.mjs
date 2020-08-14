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
import XXHash from 'xxhash';
import rollup from 'rollup';
import postcss from "postcss";
import postcssImport from "postcss-import";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import commander from "commander";
// needed for legacy bundle
import babel from '@rollup/plugin-babel';
// needed to find the polyfill modules in the main-legacy.js bundle
import { nodeResolve } from '@rollup/plugin-node-resolve';
// needed because some of the polyfills are written as commonjs modules
import commonjs from '@rollup/plugin-commonjs';
// multi-entry plugin so we can add polyfill file to main
import multi from '@rollup/plugin-multi-entry';
// replace urls of asset names with content hashed version
import postcssUrl from "postcss-url";

import cssvariables from "postcss-css-variables";
import flexbugsFixes from "postcss-flexbugs-fixes";

const PROJECT_ID = "hydrogen";
const PROJECT_SHORT_NAME = "Hydrogen";
const PROJECT_NAME = "Hydrogen Chat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = path.join(__dirname, "../");
const cssSrcDir = path.join(projectDir, "src/ui/web/css/");
const targetDir = path.join(projectDir, "target/");

const program = new commander.Command();
program
    .option("--legacy", "make a build for IE11")
    .option("--no-offline", "make a build without a service worker or appcache manifest")
program.parse(process.argv);
const {debug, noOffline, legacy} = program;
const offline = !noOffline;

async function build() {
    // get version number
    const version = JSON.parse(await fs.readFile(path.join(projectDir, "package.json"), "utf8")).version;

    const devHtml = await fs.readFile(path.join(projectDir, "index.html"), "utf8");
    const doc = cheerio.load(devHtml);
    const themes = [];
    findThemes(doc, themeName => {
        themes.push(themeName);
    });
    // clear target dir
    await removeDirIfExists(targetDir);
    await createDirs(targetDir, themes);
    // also creates the directories where the theme css bundles are placed in,
    // so do it first
    const themeAssets = await copyThemeAssets(themes, legacy);
    const jsBundlePath = await (legacy ? buildJsLegacy() : buildJs());
    const cssBundlePaths = await buildCssBundles(legacy ? buildCssLegacy : buildCss, themes, themeAssets);
    const assetPaths = createAssetPaths(jsBundlePath, cssBundlePaths, themeAssets);

    if (offline) {
        await buildOffline(version, assetPaths);
    }
    await buildHtml(doc, version, assetPaths);

    console.log(`built ${PROJECT_ID}${legacy ? " legacy" : ""} ${version} successfully`);
}

function createAssetPaths(jsBundlePath, cssBundlePaths, themeAssets) {
    function trim(path) {
        if (!path.startsWith(targetDir)) {
            throw new Error("invalid target path: " + targetDir);
        }
        return path.substr(targetDir.length);
    }
    return {
        jsBundle: () => trim(jsBundlePath),
        cssMainBundle: () => trim(cssBundlePaths.main),
        cssThemeBundle: themeName => trim(cssBundlePaths.themes[themeName]),
        cssThemeBundles: () => Object.values(cssBundlePaths.themes).map(a => trim(a)),
        otherAssets: () => Object.values(themeAssets).map(a => trim(a))
    };
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

async function createDirs(targetDir, themes) {
    await fs.mkdir(targetDir);
    const themeDir = path.join(targetDir, "themes");
    await fs.mkdir(themeDir);
    for (const theme of themes) {
        await fs.mkdir(path.join(themeDir, theme));
    }
}

async function copyThemeAssets(themes, legacy) {
    const assets = {};
    for (const theme of themes) {
        const themeDstFolder = path.join(targetDir, `themes/${theme}`);
        const themeSrcFolder = path.join(cssSrcDir, `themes/${theme}`);
        const themeAssets = await copyFolder(themeSrcFolder, themeDstFolder, file => {
            const isUnneededFont = legacy ? file.endsWith(".woff2") : file.endsWith(".woff");
            return !file.endsWith(".css") && !isUnneededFont;
        });
        Object.assign(assets, themeAssets);
    }
    return assets;
}

async function buildHtml(doc, version, assetPaths) {
    // transform html file
    // change path to main.css to css bundle
    doc("link[rel=stylesheet]:not([title])").attr("href", assetPaths.cssMainBundle());
    // change paths to all theme stylesheets
    findThemes(doc, (themeName, theme) => {
        theme.attr("href", assetPaths.cssThemeBundle(themeName));
    });
    doc("script#main").replaceWith(
        `<script type="text/javascript" src="${assetPaths.jsBundle()}"></script>` +
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

async function buildJs() {
    // create js bundle
    const bundle = await rollup.rollup({input: 'src/main.js'});
    const {output} = await bundle.generate({
        format: 'iife',
        name: `${PROJECT_ID}Bundle`
    });
    const code = output[0].code;
    const bundlePath = resource(`${PROJECT_ID}.js`, code);
    await fs.writeFile(bundlePath, code, "utf8");
    return bundlePath;
}

async function buildJsLegacy() {
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
    const {output} = await bundle.generate({
        format: 'iife',
        name: `${PROJECT_ID}Bundle`
    });
    const code = output[0].code;
    const bundlePath = resource(`${PROJECT_ID}-legacy.js`, code);
    await fs.writeFile(bundlePath, code, "utf8");
    return bundlePath;
}

async function buildOffline(version, assetPaths) {
    // write offline availability
    const offlineFiles = [
        assetPaths.jsBundle(),
        assetPaths.cssMainBundle(),
        "index.html",
        "icon-192.png",
    ].concat(assetPaths.cssThemeBundles());

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
    swSource = swSource.replace(`"%%OFFLINE_FILES%%"`, JSON.stringify(offlineFiles));
    swSource = swSource.replace(`"%%CACHE_FILES%%"`, JSON.stringify(assetPaths.otherAssets()));
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
    // should this icon have a content hash as well?
    let icon = await fs.readFile(path.join(projectDir, "icon.png"));
    await fs.writeFile(path.join(targetDir, "icon-192.png"), icon);
}

async function buildCssBundles(buildFn, themes, themeAssets) {
    const bundleCss = await buildFn(path.join(cssSrcDir, "main.css"));
    const mainDstPath = resource(`${PROJECT_ID}.css`, bundleCss);
    await fs.writeFile(mainDstPath, bundleCss, "utf8");
    const bundlePaths = {main: mainDstPath, themes: {}};
    for (const theme of themes) {
        const urlBase = path.join(targetDir, `themes/${theme}/`);
        const assetUrlMapper = ({absolutePath}) => {
            const hashedDstPath = themeAssets[absolutePath];
            if (hashedDstPath && hashedDstPath.startsWith(urlBase)) {
                return hashedDstPath.substr(urlBase.length);
            }
        };
        const themeCss = await buildFn(path.join(cssSrcDir, `themes/${theme}/theme.css`), assetUrlMapper);
        const themeDstPath = resource(`themes/${theme}/bundle.css`, themeCss);
        await fs.writeFile(themeDstPath, themeCss, "utf8");
        bundlePaths.themes[theme] = themeDstPath;
    }
    return bundlePaths;
}

async function buildCss(entryPath, urlMapper = null) {
    const preCss = await fs.readFile(entryPath, "utf8");
    const options = [postcssImport];
    if (urlMapper) {
        options.push(postcssUrl({url: urlMapper}));
    }
    const cssBundler = postcss(options);
    const result = await cssBundler.process(preCss, {from: entryPath});
    return result.css;
}

async function buildCssLegacy(entryPath, urlMapper = null) {
    const preCss = await fs.readFile(entryPath, "utf8");
    const options = [
        postcssImport,
        cssvariables(),
        flexbugsFixes()
    ];
    if (urlMapper) {
        options.push(postcssUrl({url: urlMapper}));
    }
    const cssBundler = postcss(options);
    const result = await cssBundler.process(preCss, {from: entryPath});
    return result.css;
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
    const assetPaths = {};
    const dirEnts = await fs.readdir(srcRoot, {withFileTypes: true});
    for (const dirEnt of dirEnts) {
        const dstPath = path.join(dstRoot, dirEnt.name);
        const srcPath = path.join(srcRoot, dirEnt.name);
        if (dirEnt.isDirectory()) {
            await fs.mkdir(dstPath);
            Object.assign(assetPaths, await copyFolder(srcPath, dstPath, filter));
        } else if (dirEnt.isFile() && filter(srcPath)) {
            const content = await fs.readFile(srcPath);
            const hashedDstPath = resource(dstPath, content);
            await fs.writeFile(hashedDstPath, content);
            assetPaths[srcPath] = hashedDstPath;
        }
    }
    return assetPaths;
}

function resource(relPath, content) {
    let fullPath = relPath;
    if (!relPath.startsWith("/")) {
        fullPath = path.join(targetDir, relPath);
    }
    const hash = contentHash(Buffer.from(content));
    const dir = path.dirname(fullPath);
    const extname = path.extname(fullPath);
    const basename = path.basename(fullPath, extname);
    return path.join(dir, `${basename}-${hash}${extname}`);
}

function contentHash(str) {
    var hasher = new XXHash(0);
    hasher.update(str);
    return hasher.digest();
}


build().catch(err => console.error(err));
