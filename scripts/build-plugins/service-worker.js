const fs = require('fs/promises');
const path = require('path');
const xxhash = require('xxhashjs');

function contentHash(str) {
    var hasher = new xxhash.h32(0);
    hasher.update(str);
    return hasher.digest();
}

module.exports = function injectServiceWorker(swFile) {
    let root;
    let version;
    let manifestHref;
    return {
        name: "hydrogen:injectServiceWorker",
        apply: "build",
        enforce: "post",
        configResolved: config => {
            root = config.root;
            version = JSON.parse(config.define.HYDROGEN_VERSION); // unquote
        },
        generateBundle: async function(_, bundle) {
            const absoluteSwFile = path.resolve(root, swFile);
            const packageManifest = path.resolve(path.join(__dirname, "../../package.json"));
            let swSource = await fs.readFile(absoluteSwFile, {encoding: "utf8"});
            const assets = Object.values(bundle).filter(a => a.type === "asset");
            const cachedFileNames = assets.map(o => o.fileName).filter(fileName => fileName !== "index.html");
            const r = Object.entries(bundle).find(([key, asset]) => key.includes("index.html"));
            const index = assets.find(o => o.fileName === "index.html");
            if (!index) {
                console.log("index not found", index, r);
            }
            const uncachedFileContentMap = {
                "index.html": index.source,
                "sw.js": swSource
            };
            const globalHash = getBuildHash(cachedFileNames, uncachedFileContentMap);
            swSource = await buildServiceWorker(swSource, version, globalHash, assets);
            const outputName = path.basename(absoluteSwFile);
            // TODO: do normal build transformations for service worker too,
            // I think if we emit it as a chunk rather than an asset it would
            // but we can't emit chunks anymore in generateBundle I think ...
            this.emitFile({
                type: "asset",
                fileName: outputName,
                source: swSource
            });
        }
    };
}

function getBuildHash(cachedFileNames, uncachedFileContentMap) {
    const unhashedHashes = Object.entries(uncachedFileContentMap).map(([fileName, content]) => {
        return `${fileName}-${contentHash(Buffer.from(content))}`;
    });
    const globalHashAssets = cachedFileNames.concat(unhashedHashes);
    globalHashAssets.sort();
    return contentHash(globalHashAssets.join(",")).toString();
}

const NON_PRECACHED_JS = [
    "hydrogen-legacy",
    "olm_legacy.js",
     // most environments don't need the worker
    "main.js"
];

function isPreCached(asset) {
    const {name, fileName} = asset;
    return  name.endsWith(".svg") ||
            name.endsWith(".png") ||
            name.endsWith(".css") ||
            name.endsWith(".wasm") ||
            name.endsWith(".html") ||
            // the index and vendor chunks don't have an extension in `name`, so check extension on `fileName`
            fileName.endsWith(".js") && !NON_PRECACHED_JS.includes(path.basename(name));
}

async function buildServiceWorker(swSource, version, globalHash, assets) {
    const unhashedPreCachedAssets = [];
    const hashedPreCachedAssets = [];
    const hashedCachedOnRequestAssets = [];

    for (const asset of assets) {
        const {name: unresolved, fileName: resolved} = asset;
        if (!unresolved || resolved === unresolved) {
            unhashedPreCachedAssets.push(resolved);
        } else if (isPreCached(asset)) {
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
    swSource = replaceStringInSource("NOTIFICATION_BADGE_ICON", assets.find(a => a.name === "icon.png").fileName);
    return swSource;
}
