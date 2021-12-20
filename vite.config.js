const injectWebManifest = require("./scripts/build-plugins/manifest");
const {injectServiceWorker, createPlaceholderValues} = require("./scripts/build-plugins/service-worker");
const {defineConfig} = require('vite');
const mergeOptions = require('merge-options').bind({concatArrays: true});
const commonOptions = require("./vite.common-config.js");

export default defineConfig(({mode}) => {
    const definePlaceholders = createPlaceholderValues(mode);
    return mergeOptions(commonOptions, {
        root: "src/platform/web",
        base: "./",
        resolve: {
            alias: {
                // these should only be imported by the base-x package in any runtime code
                // and works in the browser with a Uint8Array shim,
                // rather than including a ton of polyfill code
                "safe-buffer": "./scripts/package-overrides/safe-buffer/index.js",
                "buffer": "./scripts/package-overrides/buffer/index.js",
            }
        },
        build: {
            outDir: "../../../target",
            minify: true,
            sourcemap: true,
        },
        plugins: [
            // important this comes before service worker
            // otherwise the manifest and the icons it refers to won't be cached
            injectWebManifest("assets/manifest.json"),
            injectServiceWorker("./src/platform/web/sw.js", ["index.html"], {
                // placeholders to replace at end of build by chunk name
                "index": {DEFINE_GLOBAL_HASH: definePlaceholders.DEFINE_GLOBAL_HASH},
                "sw": definePlaceholders
            }),
        ],
        define: definePlaceholders,
    });
});
