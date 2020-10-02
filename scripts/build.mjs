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
import xxhash from 'xxhashjs';
import { rollup } from 'rollup';
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
import removeJsComments from 'rollup-plugin-cleanup';
// replace urls of asset names with content hashed version
import postcssUrl from "postcss-url";

import cssvariables from "postcss-css-variables";
import flexbugsFixes from "postcss-flexbugs-fixes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = path.join(__dirname, "../");
const cssSrcDir = path.join(projectDir, "src/ui/web/css/");
const targetDir = path.join(projectDir, "target/");

const program = new commander.Command();
program
    .option("--no-offline", "make a build without a service worker or appcache manifest")
program.parse(process.argv);
const {noOffline} = program;
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
    const assets = new AssetMap(targetDir);
    // copy olm assets
    const olmAssets = await copyFolder(path.join(projectDir, "lib/olm/"), assets.directory);
    assets.addSubMap(olmAssets);
    await assets.write(`hydrogen.js`, await buildJs("src/main.js"));
    await assets.write(`hydrogen-legacy.js`, await buildJsLegacy(["src/main.js", 'src/legacy-polyfill.js', 'src/legacy-extras.js']));
    await assets.write(`worker.js`, await buildJsLegacy(["src/worker.js", 'src/worker-polyfill.js']));
    // creates the directories where the theme css bundles are placed in,
    // and writes to assets, so the build bundles can translate them, so do it first
    await copyThemeAssets(themes, assets);
    await buildCssBundles(buildCssLegacy, themes, assets);
    if (offline) {
        await buildOffline(version, assets);
    }
    await buildHtml(doc, version, assets);
    // 3 unhashed assets: index.html, manifest.appcache and sw.js
    console.log(`built hydrogen ${version} successfully with ${assets.all().length + 3} files`);
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

async function copyThemeAssets(themes, assets) {
    for (const theme of themes) {
        const themeDstFolder = path.join(targetDir, `themes/${theme}`);
        const themeSrcFolder = path.join(cssSrcDir, `themes/${theme}`);
        const themeAssets = await copyFolder(themeSrcFolder, themeDstFolder, file => {
            return !file.endsWith(".css");
        });
        assets.addSubMap(themeAssets);
    }
    return assets;
}

async function buildHtml(doc, version, assets) {
    // transform html file
    // change path to main.css to css bundle
    doc("link[rel=stylesheet]:not([title])").attr("href", assets.resolve(`hydrogen.css`));
    // change paths to all theme stylesheets
    findThemes(doc, (themeName, theme) => {
        theme.attr("href", assets.resolve(`themes/${themeName}/bundle.css`));
    });
    const pathsJSON = JSON.stringify({
        worker: assets.resolve(`worker.js`),
        olm: {
            wasm: assets.resolve("olm.wasm"),
            legacyBundle: assets.resolve("olm_legacy.js"),
            wasmBundle: assets.resolve("olm.js"),
        }
    });
    doc("script#main").replaceWith(
        `<script type="module">import {main} from "./${assets.resolve(`hydrogen.js`)}"; main(document.body, ${pathsJSON});</script>` +
        `<script type="text/javascript" nomodule src="${assets.resolve(`hydrogen-legacy.js`)}"></script>` +
        `<script type="text/javascript" nomodule>hydrogenBundle.main(document.body, ${pathsJSON}, hydrogenBundle.legacyExtras);</script>`);
    removeOrEnableScript(doc("script#service-worker"), offline);

    const versionScript = doc("script#version");
    versionScript.attr("type", "text/javascript");
    let vSource = versionScript.contents().text();
    vSource = vSource.replace(`"%%VERSION%%"`, `"${version}"`);
    versionScript.text(vSource);

    if (offline) {
        doc("html").attr("manifest", "manifest.appcache");
        doc("head").append(`<link rel="manifest" href="${assets.resolve("manifest.json")}">`);
    }
    await fs.writeFile(path.join(targetDir, "index.html"), doc.html(), "utf8");
}

async function buildJs(inputFile) {
    // create js bundle
    const bundle = await rollup({
        input: inputFile,
        plugins: [removeJsComments({comments: "none"})]
    });
    const {output} = await bundle.generate({
        format: 'es',
        // TODO: can remove this?
        name: `hydrogenBundle`
    });
    const code = output[0].code;
    return code;
}

async function buildJsLegacy(inputFiles) {
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
                    targets: "IE 11",
                    // we provide our own promise polyfill (es6-promise)
                    // with support for synchronous flushing of
                    // the queue for idb where needed 
                    exclude: ["es.promise", "es.promise.all-settled", "es.promise.finally"]
                }
            ]
        ]
    });
    // create js bundle
    const rollupConfig = {
        input: inputFiles,
        plugins: [multi(), commonjs(), nodeResolve(), babelPlugin]
    };
    const bundle = await rollup(rollupConfig);
    const {output} = await bundle.generate({
        format: 'iife',
        name: `hydrogenBundle`
    });
    const code = output[0].code;
    return code;
}

async function buildOffline(version, assets) {
    const webManifest = JSON.parse(await fs.readFile(path.join(projectDir, "assets/manifest.json"), "utf8"));
    // copy manifest icons
    for (const icon of webManifest.icons) {
        let iconData = await fs.readFile(path.join(projectDir, icon.src));
        const iconTargetPath = path.basename(icon.src);
        icon.src = await assets.write(iconTargetPath, iconData);
    }
    // write appcache manifest
    const appCacheLines = [
        `CACHE MANIFEST`,
        `# v${version}`,
        `NETWORK`,
        `"*"`,
        `CACHE`,
    ];
    appCacheLines.push(...assets.allWithout(["hydrogen.js"]));
    const swOfflineFiles = assets.allWithout(["hydrogen-legacy.js", "olm_legacy.js"]);
    const appCacheManifest = appCacheLines.join("\n") + "\n";
    await fs.writeFile(path.join(targetDir, "manifest.appcache"), appCacheManifest, "utf8");
    // write service worker
    let swSource = await fs.readFile(path.join(projectDir, "src/service-worker.template.js"), "utf8");
    swSource = swSource.replace(`"%%VERSION%%"`, `"${version}"`);
    swSource = swSource.replace(`"%%OFFLINE_FILES%%"`, JSON.stringify(swOfflineFiles));
    // service worker should not have a hashed name as it is polled by the browser for updates
    await fs.writeFile(path.join(targetDir, "sw.js"), swSource, "utf8");
    await assets.write("manifest.json", JSON.stringify(webManifest));
}

async function buildCssBundles(buildFn, themes, assets) {
    const bundleCss = await buildFn(path.join(cssSrcDir, "main.css"));
    await assets.write(`hydrogen.css`, bundleCss);
    for (const theme of themes) {
        const themeRelPath = `themes/${theme}/`;
        const themeRoot = path.join(cssSrcDir, themeRelPath);
        const assetUrlMapper = ({absolutePath}) => {
            if (!absolutePath.startsWith(themeRoot)) {
                throw new Error("resource is out of theme directory: " + absolutePath);
            }
            const relPath = absolutePath.substr(themeRoot.length);
            const hashedDstPath = assets.resolve(path.join(themeRelPath, relPath));
            if (hashedDstPath) {
                return hashedDstPath.substr(themeRelPath.length);
            }
        };
        const themeCss = await buildFn(path.join(themeRoot, `theme.css`), assetUrlMapper);
        await assets.write(path.join(themeRelPath, `bundle.css`), themeCss);
    }
}

// async function buildCss(entryPath, urlMapper = null) {
//     const preCss = await fs.readFile(entryPath, "utf8");
//     const options = [postcssImport];
//     if (urlMapper) {
//         options.push(postcssUrl({url: urlMapper}));
//     }
//     const cssBundler = postcss(options);
//     const result = await cssBundler.process(preCss, {from: entryPath});
//     return result.css;
// }

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

async function copyFolder(srcRoot, dstRoot, filter, assets = null) {
    assets = assets || new AssetMap(dstRoot);
    const dirEnts = await fs.readdir(srcRoot, {withFileTypes: true});
    for (const dirEnt of dirEnts) {
        const dstPath = path.join(dstRoot, dirEnt.name);
        const srcPath = path.join(srcRoot, dirEnt.name);
        if (dirEnt.isDirectory()) {
            await fs.mkdir(dstPath);
            await copyFolder(srcPath, dstPath, filter, assets);
        } else if ((dirEnt.isFile() || dirEnt.isSymbolicLink()) && (!filter || filter(srcPath))) {
            const content = await fs.readFile(srcPath);
            await assets.write(dstPath, content);
        }
    }
    return assets;
}

function contentHash(str) {
    var hasher = new xxhash.h32(0);
    hasher.update(str);
    return hasher.digest();
}

class AssetMap {
    constructor(targetDir) {
        // remove last / if any, so substr in create works well
        this._targetDir = path.resolve(targetDir);
        this._assets = new Map();
    }

    _toRelPath(resourcePath) {
        let relPath = resourcePath;
        if (path.isAbsolute(resourcePath)) {
            if (!resourcePath.startsWith(this._targetDir)) {
                throw new Error(`absolute path ${resourcePath} that is not within target dir ${this._targetDir}`);
            }
            relPath = resourcePath.substr(this._targetDir.length + 1); // + 1 for the /
        }
        return relPath;
    }

    _create(resourcePath, content) {
        const relPath = this._toRelPath(resourcePath);
        const hash = contentHash(Buffer.from(content));
        const dir = path.dirname(relPath);
        const extname = path.extname(relPath);
        const basename = path.basename(relPath, extname);
        const dstRelPath = path.join(dir, `${basename}-${hash}${extname}`);
        this._assets.set(relPath, dstRelPath);
        return dstRelPath;
    }

    async write(resourcePath, content) {
        const relPath = this._create(resourcePath, content);
        const fullPath = path.join(this.directory, relPath);
        if (typeof content === "string") {
            await fs.writeFile(fullPath, content, "utf8");
        } else {
            await fs.writeFile(fullPath, content);
        }
        return relPath;
    }
    }

    get directory() {
        return this._targetDir;
    }

    resolve(resourcePath) {
        const relPath = this._toRelPath(resourcePath);
        const result = this._assets.get(relPath);
        if (!result) {
            throw new Error(`unknown path: ${relPath}, only know ${Array.from(this._assets.keys()).join(", ")}`);
        }
        return result;
    }

    addSubMap(assetMap) {
        if (!assetMap.directory.startsWith(this.directory)) {
            throw new Error(`map directory doesn't start with this directory: ${assetMap.directory} ${this.directory}`);
        }
        console.log("adding submap from", assetMap.directory, this.directory);
        const relSubRoot = assetMap.directory.substr(this.directory.length + 1);
        for (const [key, value] of assetMap._assets.entries()) {
            this._assets.set(path.join(relSubRoot, key), path.join(relSubRoot, value));
        }
    }

    all() {
        return Array.from(this._assets.values());
    }

    allWithout(excluded) {
        excluded = excluded.map(p => this.resolve(p));
        return this.all().filter(p => excluded.indexOf(p) === -1);
    }
}



build().catch(err => console.error(err));
