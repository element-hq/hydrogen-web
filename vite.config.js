const cssvariables = require("postcss-css-variables");
const autoprefixer = require("autoprefixer");
const flexbugsFixes = require("postcss-flexbugs-fixes");

const fs = require("fs");
const path = require("path");

const injectWebManifest = require("./scripts/build-plugins/manifest");
const injectServiceWorker = require("./scripts/build-plugins/service-worker");
// const legacyBuild = require("./scripts/build-plugins/legacy-build");

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
        // legacyBuild(scriptTagPath(path.join(__dirname, "src/platform/web/index.html"), 0), {
        //     "./Platform": "./LegacyPlatform"
        // }, "hydrogen-legacy", [
        //     './legacy-polyfill',
        // ]),
        injectWebManifest("assets/manifest.json"),
        injectServiceWorker("sw.js"),
    ],
    define: {
        "HYDROGEN_VERSION": JSON.stringify(version)
    },
    css: {
        postcss: {
            plugins: [
                cssvariables({
                    preserve: (declaration) => {
                        return declaration.value.indexOf("var(--ios-") == 0;
                    }
                }),
                // the grid option creates some source fragment that causes the vite warning reporter to crash because
                // it wants to log a warning on a line that does not exist in the source fragment.
                // autoprefixer({overrideBrowserslist: ["IE 11"], grid: "no-autoplace"}),
                flexbugsFixes()
            ]
        }
    }
};

function scriptTagPath(htmlFile, index) {
    return `${htmlFile}?html-proxy&index=${index}.js`;
}
