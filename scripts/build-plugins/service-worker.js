const fs = require('fs/promises');
const path = require('path');
const xxhash = require('xxhashjs');

function contentHash(str) {
    var hasher = new xxhash.h32(0);
    hasher.update(str);
    return hasher.digest();
}

function injectServiceWorker(swFile, otherUnhashedFiles, placeholdersPerChunk) {
    const swName = path.basename(swFile);
    let root;
    let version;
    let logger;

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
            version = JSON.parse(config.define.DEFINE_VERSION); // unquote
            logger = config.logger;
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
            const placeholderValues = {
                DEFINE_GLOBAL_HASH: `"${globalHash}"`,
                ...getCacheFileNamePlaceholderValues(swName, unhashedFilenames, assets, placeholdersPerChunk)
            };
            replacePlaceholdersInChunks(assets, placeholdersPerChunk, placeholderValues);
            logger.info(`\nBuilt ${version} (${globalHash})`);
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

function getCacheFileNamePlaceholderValues(swName, unhashedFilenames, assets) {
    const unhashedPreCachedAssets = [];
    const hashedPreCachedAssets = [];
    const hashedCachedOnRequestAssets = [];

    for (const asset of assets) {
        const {name, fileName} = asset;
        // the service worker should not be cached at all,
        // it's how updates happen
        if (fileName === swName) {
            continue;
        } else if (unhashedFilenames.includes(fileName)) {
            unhashedPreCachedAssets.push(fileName);
        } else if (isPreCached(asset)) {
            hashedPreCachedAssets.push(fileName);
        } else {
            hashedCachedOnRequestAssets.push(fileName);
        }
    }

    return {
        DEFINE_UNHASHED_PRECACHED_ASSETS: JSON.stringify(unhashedPreCachedAssets),
        DEFINE_HASHED_PRECACHED_ASSETS: JSON.stringify(hashedPreCachedAssets),
        DEFINE_HASHED_CACHED_ON_REQUEST_ASSETS: JSON.stringify(hashedCachedOnRequestAssets)
    }
}

function replacePlaceholdersInChunks(assets, placeholdersPerChunk, placeholderValues) {
    for (const [name, placeholderMap] of Object.entries(placeholdersPerChunk)) {
        const chunk = assets.find(a => a.type === "chunk" && a.name === name);
        if (!chunk) {
            throw new Error(`could not find chunk ${name} to replace placeholders`);
        }
        for (const [placeholderName, placeholderLiteral] of Object.entries(placeholderMap)) {
            const replacedValue = placeholderValues[placeholderName];
            const oldCode = chunk.code;
            chunk.code = chunk.code.replaceAll(placeholderLiteral, replacedValue);
            if (chunk.code === oldCode) {
                throw new Error(`Could not replace ${placeholderName} in ${name}, looking for literal ${placeholderLiteral}:\n${chunk.code}`);
            }
        }
    }
}

/** creates a value to be include in the `define` build settings,
 * but can be replace at the end of the build in certain chunks.
 * We need this for injecting the global build hash and the final
 * filenames in the service worker and index chunk.
 * These values are only known in the generateBundle step, so we
 * replace them by unique strings wrapped in a prompt call so no
 * transformation will touch them (minifying, ...) and we can do a
 * string replacement still at the end of the build. */
function definePlaceholderValue(mode, name, devValue) {
    if (mode === "production") {
        // note that `prompt(...)` will never be in the final output, it's replaced by the final value
        // once we know at the end of the build what it is and just used as a temporary value during the build
        // as something that will not be transformed.
        // I first considered Symbol but it's not inconceivable that babel would transform this.
        return `prompt(${JSON.stringify(name)})`;
    } else {
        return JSON.stringify(devValue);
    }
}

function createPlaceholderValues(mode) {
    return {
        DEFINE_GLOBAL_HASH: definePlaceholderValue(mode, "DEFINE_GLOBAL_HASH", null),
        DEFINE_UNHASHED_PRECACHED_ASSETS: definePlaceholderValue(mode, "UNHASHED_PRECACHED_ASSETS", []),
        DEFINE_HASHED_PRECACHED_ASSETS: definePlaceholderValue(mode, "HASHED_PRECACHED_ASSETS", []),
        DEFINE_HASHED_CACHED_ON_REQUEST_ASSETS: definePlaceholderValue(mode, "HASHED_CACHED_ON_REQUEST_ASSETS", []),
    };
}

module.exports = {injectServiceWorker, createPlaceholderValues};
