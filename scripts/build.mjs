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
import autoprefixer from "autoprefixer";
import flexbugsFixes from "postcss-flexbugs-fixes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = path.join(__dirname, "../");
const cssSrcDir = path.join(projectDir, "src/platform/web/ui/css/");

const parameters = new commander.Command();
parameters
    .option("--modern-only", "don't make a legacy build")
parameters.parse(process.argv);

async function build({modernOnly}) {
    // get version number
    const version = JSON.parse(await fs.readFile(path.join(projectDir, "package.json"), "utf8")).version;

    const devHtml = await fs.readFile(path.join(projectDir, "index.html"), "utf8");
    const doc = cheerio.load(devHtml);
    const themes = [];
    findThemes(doc, themeName => {
        themes.push(themeName);
    });
    // clear target dir
    const targetDir = path.join(projectDir, "target/");
    await removeDirIfExists(targetDir);
    await createDirs(targetDir, themes);
    const assets = new AssetMap(targetDir);
    // copy olm assets
    const olmAssets = await copyFolder(path.join(projectDir, "lib/olm/"), assets.directory);
    assets.addSubMap(olmAssets);
    await assets.write(`hydrogen.js`, await buildJs("src/main.js", ["src/platform/web/Platform.js"]));
    if (!modernOnly) {
        await assets.write(`hydrogen-legacy.js`, await buildJsLegacy("src/main.js", [
            'src/platform/web/legacy-polyfill.js',
            'src/platform/web/LegacyPlatform.js'
        ]));
        await assets.write(`worker.js`, await buildJsLegacy("src/platform/web/worker/main.js", ['src/platform/web/worker/polyfill.js']));
    }
    // copy over non-theme assets
    const baseConfig = JSON.parse(await fs.readFile(path.join(projectDir, "assets/config.json"), {encoding: "utf8"}));
    const downloadSandbox = "download-sandbox.html";
    let downloadSandboxHtml = await fs.readFile(path.join(projectDir, `assets/${downloadSandbox}`));
    await assets.write(downloadSandbox, downloadSandboxHtml);
    // creates the directories where the theme css bundles are placed in,
    // and writes to assets, so the build bundles can translate them, so do it first
    await copyThemeAssets(themes, assets);
    await buildCssBundles(buildCssLegacy, themes, assets);
    await buildManifest(assets);
    // all assets have been added, create a hash from all assets name to cache unhashed files like index.html
    assets.addToHashForAll("index.html", devHtml);
    let swSource = await fs.readFile(path.join(projectDir, "src/platform/web/service-worker.js"), "utf8");
    assets.addToHashForAll("sw.js", swSource);
    
    const globalHash = assets.hashForAll();

    await buildServiceWorker(swSource, version, globalHash, assets);
    await buildHtml(doc, version, baseConfig, globalHash, modernOnly, assets);
    console.log(`built hydrogen ${version} (${globalHash}) successfully with ${assets.size} files`);
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
        const themeDstFolder = path.join(assets.directory, `themes/${theme}`);
        const themeSrcFolder = path.join(cssSrcDir, `themes/${theme}`);
        const themeAssets = await copyFolder(themeSrcFolder, themeDstFolder, file => {
            return !file.endsWith(".css");
        });
        assets.addSubMap(themeAssets);
    }
    return assets;
}

async function buildHtml(doc, version, baseConfig, globalHash, modernOnly, assets) {
    // transform html file
    // change path to main.css to css bundle
    doc("link[rel=stylesheet]:not([title])").attr("href", assets.resolve(`hydrogen.css`));
    // adjust file name of icon on iOS
    doc("link[rel=apple-touch-icon]").attr("href", assets.resolve(`icon-maskable.png`));
    // change paths to all theme stylesheets
    findThemes(doc, (themeName, theme) => {
        theme.attr("href", assets.resolve(`themes/${themeName}/bundle.css`));
    });
    const configJSON = JSON.stringify(Object.assign({}, baseConfig, {
        worker: assets.has("worker.js") ? assets.resolve(`worker.js`) : null,
        downloadSandbox: assets.resolve("download-sandbox.html"),
        serviceWorker: "sw.js",
        olm: {
            wasm: assets.resolve("olm.wasm"),
            legacyBundle: assets.resolve("olm_legacy.js"),
            wasmBundle: assets.resolve("olm.js"),
        }
    }));
    const mainScripts = [
        `<script type="module">import {main, Platform} from "./${assets.resolve(`hydrogen.js`)}"; main(new Platform(document.body, ${configJSON}));</script>`
    ];
    if (!modernOnly) {
        mainScripts.push(
            `<script type="text/javascript" nomodule src="${assets.resolve(`hydrogen-legacy.js`)}"></script>`,
            `<script type="text/javascript" nomodule>hydrogen.main(new hydrogen.Platform(document.body, ${configJSON}));</script>`
        );
    }
    doc("script#main").replaceWith(mainScripts.join(""));

    const versionScript = doc("script#version");
    versionScript.attr("type", "text/javascript");
    let vSource = versionScript.contents().text();
    vSource = vSource.replace(`"%%VERSION%%"`, `"${version}"`);
    vSource = vSource.replace(`"%%GLOBAL_HASH%%"`, `"${globalHash}"`);
    versionScript.text(vSource);
    doc("head").append(`<link rel="manifest" href="${assets.resolve("manifest.json")}">`);
    await assets.writeUnhashed("index.html", doc.html());
}

async function buildJs(mainFile, extraFiles = []) {
    // create js bundle
    const bundle = await rollup({
        input: extraFiles.concat(mainFile),
        plugins: [multi(), removeJsComments({comments: "none"})]
    });
    const {output} = await bundle.generate({
        format: 'es',
        // TODO: can remove this?
        name: `hydrogen`
    });
    const code = output[0].code;
    return code;
}

async function buildJsLegacy(mainFile, extraFiles = []) {
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
        // important the extraFiles come first,
        // so polyfills are available in the global scope
        // if needed for the mainfile
        input: extraFiles.concat(mainFile),
        plugins: [multi(), commonjs(), nodeResolve(), babelPlugin]
    };
    const bundle = await rollup(rollupConfig);
    const {output} = await bundle.generate({
        format: 'iife',
        name: `hydrogen`
    });
    const code = output[0].code;
    return code;
}

const NON_PRECACHED_JS = [
    "hydrogen-legacy.js",
    "olm_legacy.js",
    "worker.js"
];

function isPreCached(asset) {
    return  asset.endsWith(".svg") ||
            asset.endsWith(".png") ||
            asset.endsWith(".css") ||
            asset.endsWith(".wasm") ||
            asset.endsWith(".html") ||
            // most environments don't need the worker
            asset.endsWith(".js") && !NON_PRECACHED_JS.includes(asset);
}

async function buildManifest(assets) {
    const webManifest = JSON.parse(await fs.readFile(path.join(projectDir, "assets/manifest.json"), "utf8"));
    // copy manifest icons
    for (const icon of webManifest.icons) {
        let iconData = await fs.readFile(path.join(projectDir, icon.src));
        const iconTargetPath = path.basename(icon.src);
        icon.src = await assets.write(iconTargetPath, iconData);
    }
    await assets.write("manifest.json", JSON.stringify(webManifest));
}

async function buildServiceWorker(swSource, version, globalHash, assets) {
    const unhashedPreCachedAssets = ["index.html"];
    const hashedPreCachedAssets = [];
    const hashedCachedOnRequestAssets = [];

    for (const [unresolved, resolved] of assets) {
        if (unresolved === resolved) {
            unhashedPreCachedAssets.push(resolved);
        } else if (isPreCached(unresolved)) {
            hashedPreCachedAssets.push(resolved);
        } else {
            hashedCachedOnRequestAssets.push(resolved);
        }
    }

    const replaceArrayInSource = (name, value) => {
        const newSource = swSource.replace(`${name} = []`, `${name} = ${JSON.stringify(value)}`);
        if (newSource === swSource) {
            throw new Error(`${name} was not found in the service worker source`);
        }
        return newSource;
    };
    const replaceStringInSource = (name, value) => {
        const newSource = swSource.replace(new RegExp(`${name}\\s=\\s"[^"]*"`), `${name} = ${JSON.stringify(value)}`);
        if (newSource === swSource) {
            throw new Error(`${name} was not found in the service worker source`);
        }
        return newSource;
    };

    // write service worker
    swSource = swSource.replace(`"%%VERSION%%"`, `"${version}"`);
    swSource = swSource.replace(`"%%GLOBAL_HASH%%"`, `"${globalHash}"`);
    swSource = replaceArrayInSource("UNHASHED_PRECACHED_ASSETS", unhashedPreCachedAssets);
    swSource = replaceArrayInSource("HASHED_PRECACHED_ASSETS", hashedPreCachedAssets);
    swSource = replaceArrayInSource("HASHED_CACHED_ON_REQUEST_ASSETS", hashedCachedOnRequestAssets);
    swSource = replaceStringInSource("NOTIFICATION_BADGE_ICON", assets.resolve("icon.png"));

    // service worker should not have a hashed name as it is polled by the browser for updates
    await assets.writeUnhashed("sw.js", swSource);
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
        autoprefixer({overrideBrowserslist: ["IE 11"], grid: "no-autoplace"}),
        flexbugsFixes()
    ];
    if (urlMapper) {
        options.push(postcssUrl({url: urlMapper}));
    }
    const cssBundler = postcss(options);
    const result = await cssBundler.process(preCss, {from: entryPath});
    return result.css;
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
        // hashes for unhashed resources so changes in these resources also contribute to the hashForAll
        this._unhashedHashes = [];
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

    async writeUnhashed(resourcePath, content) {
        const relPath = this._toRelPath(resourcePath);
        this._assets.set(relPath, relPath);
        const fullPath = path.join(this.directory, relPath);
        if (typeof content === "string") {
            await fs.writeFile(fullPath, content, "utf8");
        } else {
            await fs.writeFile(fullPath, content);
        }
        return relPath;
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
        const relSubRoot = assetMap.directory.substr(this.directory.length + 1);
        for (const [key, value] of assetMap._assets.entries()) {
            this._assets.set(path.join(relSubRoot, key), path.join(relSubRoot, value));
        }
    }

    [Symbol.iterator]() {
        return this._assets.entries();
    }

    isUnhashed(relPath) {
        const resolvedPath = this._assets.get(relPath);
        if (!resolvedPath) {
            throw new Error("Unknown asset: " + relPath);
        }
        return relPath === resolvedPath;
    }

    get size() {
        return this._assets.size;
    }

    has(relPath) {
        return this._assets.has(relPath);
    }

    hashForAll() {
        const globalHashAssets = Array.from(this).map(([, resolved]) => resolved);
        globalHashAssets.push(...this._unhashedHashes);
        globalHashAssets.sort();
        return contentHash(globalHashAssets.join(","));
    }

    addToHashForAll(resourcePath, content) {
        this._unhashedHashes.push(`${resourcePath}-${contentHash(Buffer.from(content))}`);
    }
}

build(parameters).catch(err => console.error(err));
