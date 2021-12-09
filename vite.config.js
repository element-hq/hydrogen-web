const cssvariables = require("postcss-css-variables");
const flexbugsFixes = require("postcss-flexbugs-fixes");

const fs = require("fs");
const path = require("path");

const injectWebManifest = require("./scripts/build-plugins/manifest");
const {injectServiceWorker, createPlaceholderValues} = require("./scripts/build-plugins/service-worker");
const {defineConfig} = require('vite');
const version = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8")).version;

export default defineConfig(({mode}) => {
    const definePlaceholders = createPlaceholderValues(mode);
    return {
        public: false,
        root: "src/platform/web",
        base: "./",
        server: {
            hmr: false
        },
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
            emptyOutDir: true,
            minify: true,
            sourcemap: true,
            assetsInlineLimit: 0,
            polyfillModulePreload: false,
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
        define: {
            DEFINE_VERSION: JSON.stringify(version),
            ...definePlaceholders
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
});

function scriptTagPath(htmlFile, index) {
    return `${htmlFile}?html-proxy&index=${index}.js`;
}
