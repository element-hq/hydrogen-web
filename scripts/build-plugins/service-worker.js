const fs = require('fs/promises');
const path = require('path');
const xxhash = require('xxhashjs');

function contentHash(str) {
    var hasher = new xxhash.h32(0);
    hasher.update(str);
    return hasher.digest();
}

module.exports = function injectServiceWorker(swFile, otherUnhashedFiles, globalHashPlaceholderLiteral, chunkNamesWithGlobalHash) {
    const swName = path.basename(swFile);
    let root;
    let version;

    return {
        name: "hydrogen:injectServiceWorker",
        apply: "build",
        enforce: "post",
        buildStart() {
            this.emitFile({
                type: "chunk",
                fileName: swName,
                id: swFile,
            });
        },
        configResolved: config => {
            root = config.root;
            version = JSON.parse(config.define.HYDROGEN_VERSION); // unquote
        },
        generateBundle: async function(options, bundle) {
            const unhashedFilenames = [swName].concat(otherUnhashedFiles);
            const unhashedFileContentMap = unhashedFilenames.reduce((map, fileName) => {
                const chunkOrAsset = bundle[fileName];
                if (!chunkOrAsset) {
                    throw new Error("could not get content for uncached asset or chunk " + fileName);
                }
                map[fileName] = chunkOrAsset.source || chunkOrAsset.code;
                return map;
            }, {});
            const assets = Object.values(bundle);
            const hashedFileNames = assets.map(o => o.fileName).filter(fileName => !unhashedFileContentMap[fileName]);
            const globalHash = getBuildHash(hashedFileNames, unhashedFileContentMap);
            const sw = bundle[swName];
            sw.code = replaceCacheFilenamesInServiceWorker(sw, unhashedFilenames, assets);
            replaceGlobalHashPlaceholderInChunks(assets, chunkNamesWithGlobalHash, globalHashPlaceholderLiteral, `"${globalHash}"`);
            console.log(`\nBuilt ${version} (${globalHash})`);
        }
    };
}

function getBuildHash(hashedFileNames, unhashedFileContentMap) {
    const unhashedHashes = Object.entries(unhashedFileContentMap).map(([fileName, content]) => {
        return `${fileName}-${contentHash(Buffer.from(content))}`;
    });
    const globalHashAssets = hashedFileNames.concat(unhashedHashes);
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

function replaceCacheFilenamesInServiceWorker(swChunk, unhashedFilenames, assets) {
    let swSource = swChunk.code;
    const unhashedPreCachedAssets = [];
    const hashedPreCachedAssets = [];
    const hashedCachedOnRequestAssets = [];

    for (const asset of assets) {
        const {name, fileName} = asset;
        // the service worker should not be cached at all,
        // it's how updates happen
        if (fileName === swChunk.fileName) {
            continue;
        } else if (unhashedFilenames.includes(fileName)) {
            unhashedPreCachedAssets.push(fileName);
        } else if (isPreCached(asset)) {
            hashedPreCachedAssets.push(fileName);
        } else {
            hashedCachedOnRequestAssets.push(fileName);
        }
    }

    const replaceArrayInSource = (name, value) => {
        const newSource = swSource.replace(`${name} = []`, `${name} = ${JSON.stringify(value)}`);
        if (newSource === swSource) {
            throw new Error(`${name} was not found in the service worker source: ` + swSource);
        }
        return newSource;
    };
    const replaceStringInSource = (name, value) => {
        const newSource = swSource.replace(new RegExp(`${name}\\s=\\s"[^"]*"`), `${name} = ${JSON.stringify(value)}`);
        if (newSource === swSource) {
            throw new Error(`${name} was not found in the service worker source: ` + swSource);
        }
        return newSource;
    };

    swSource = replaceArrayInSource("UNHASHED_PRECACHED_ASSETS", unhashedPreCachedAssets);
    swSource = replaceArrayInSource("HASHED_PRECACHED_ASSETS", hashedPreCachedAssets);
    swSource = replaceArrayInSource("HASHED_CACHED_ON_REQUEST_ASSETS", hashedCachedOnRequestAssets);
    return swSource;
}

function replaceGlobalHashPlaceholderInChunks(assets, chunkNamesWithGlobalHash, globalHashPlaceholderLiteral, globalHashLiteral) {
    for (const name of chunkNamesWithGlobalHash) {
        const chunk = assets.find(a => a.type === "chunk" && a.name === name);
        if (!chunk) {
            throw new Error(`could not find chunk ${name} to replace global hash placeholder`);
        }
        chunk.code = chunk.code.replaceAll(globalHashPlaceholderLiteral, globalHashLiteral);
    }
}
