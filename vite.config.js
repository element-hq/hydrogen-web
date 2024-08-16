const injectWebManifest = require("./scripts/build-plugins/manifest");
const {injectServiceWorker, createPlaceholderValues} = require("./scripts/build-plugins/service-worker");
const {
    transformServiceWorkerInDevServer,
} = require("./scripts/build-plugins/sw-dev");
const themeBuilder = require("./scripts/build-plugins/rollup-plugin-build-themes");
const { defineConfig } = require("vite");
const mergeOptions = require("merge-options").bind({ concatArrays: true });
const { commonOptions, compiledVariables } = require("./vite.common-config.js");

export default defineConfig(({ mode }) => {
    const definePlaceholders = createPlaceholderValues(mode);
    const options = commonOptions(mode);
    return mergeOptions(options, {
        root: "src/platform/web",
        base: "./",
        publicDir: "./public",
        build: {
            outDir: "../../../target",
            minify: true,
            sourcemap: true,
            rollupOptions: {
                output: {
                    assetFileNames: (asset) => {
                        if (asset.name.includes("config.json")) {
                            return "[name][extname]";
                        } else if (asset.name.match(/theme-.+\.json/)) {
                            return "assets/[name][extname]";
                        } else {
                            return "assets/[name].[hash][extname]";
                        }
                    },
                },
            },
        },
        plugins: [
            transformServiceWorkerInDevServer(),
            themeBuilder({
                themeConfig: {
                    themes: ["./src/platform/web/ui/css/themes/element"],
                    default: "element",
                },
                compiledVariables,
            }),
            // important this comes before service worker
            // otherwise the manifest and the icons it refers to won't be cached
            injectWebManifest("assets/manifest.json"),
            injectServiceWorker(
                "./src/platform/web/sw.js",
                findUnhashedFileNamesFromBundle,
                {
                    // placeholders to replace at end of build by chunk name
                    index: {
                        DEFINE_GLOBAL_HASH:
                            definePlaceholders.DEFINE_GLOBAL_HASH,
                    },
                    sw: definePlaceholders,
                }
            ),
        ],
    });
});

function findUnhashedFileNamesFromBundle(bundle) {
    const names = ["index.html"];
    for (const fileName of Object.keys(bundle)) {
        if (fileName.includes("config.json")) {
            names.push(fileName);
        }
        if (/theme-.+\.json/.test(fileName)) {
            names.push(fileName);
        }
    }
    return names;
}
