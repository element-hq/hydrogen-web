const injectWebManifest = require("./scripts/build-plugins/manifest");
const injectServiceWorker = require("./scripts/build-plugins/service-worker");
const legacyBuild = require("./scripts/build-plugins/legacy-build");
const fs = require("fs");
const path = require("path");
// we could also just import {version} from "../../package.json" where needed,
// but this won't work in the service worker yet as it is not transformed yet
// TODO: we should emit a chunk early on and then transform the asset again once we know all the other assets to cache
const version = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8")).version;
const {defineConfig} = require("vite");
let polyfillSrc;
let polyfillRef;

export default {
    public: false,
    root: "src/platform/web",
    server: {
        hmr: false
    },
    resolve: {
        alias: {
            "safe-buffer": "./scripts/package-overrides/safe-buffer/index.js",
            "buffer": "./scripts/package-overrides/buffer/index.js",
        }
    },
    build: {
        outDir: "../../../target",
        emptyOutDir: true,
        minify: true,
        sourcemap: false,
        assetsInlineLimit: 0,
        polyfillModulePreload: false,
    },
    plugins: [
        // legacyBuild(path.join(__dirname, "src/platform/web/index.html?html-proxy&index=0.js"), {
        //     "./Platform": "./LegacyPlatform"
        // }, "hydrogen-legacy", [
        //     './legacy-polyfill',
        // ]),
        injectWebManifest("assets/manifest.json"),
        injectServiceWorker("sw.js"),
    ],
    define: {
        "HYDROGEN_VERSION": JSON.stringify(version)
    }
};
