const injectWebManifest = require("./scripts/build-plugins/manifest");
const injectServiceWorker = require("./scripts/build-plugins/service-worker");

export default {
    public: false,
    root: "src/platform/web",
    server: {
        hmr: false
    },
    resolve: {
        alias: {
            "safe-buffer": "./scripts/package-overrides/safe-buffer/index.js",
            "buffer": "./scripts/package-overrides/buffer/index.js"
        }
    },
    build: {
        outDir: "../../../target",
        emptyOutDir: true,
        minify: true,
        sourcemap: true
    },
    plugins: [
        injectWebManifest("assets/manifest.json"),
        injectServiceWorker("sw.js")
    ]
};
