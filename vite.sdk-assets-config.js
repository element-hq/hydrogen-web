const path = require("path");
const mergeOptions = require("merge-options").bind({ concatArrays: true });
const themeBuilder = require("./scripts/build-plugins/rollup-plugin-build-themes");
const { commonOptions, compiledVariables } = require("./vite.common-config.js");
const { defineConfig } = require("vite");

// These paths will be saved without their hash so they have a consisent path
// that we can reference in our `package.json` `exports`. And so people can import
// them with a consistent path.
const pathsToExport = [
    "main.js",
    "download-sandbox.html",
    "theme-element-light.css",
    "theme-element-dark.css",
];

export default defineConfig(({ mode }) => {
    const options = commonOptions(mode);
    return mergeOptions(options, {
        root: "src/",
        base: "./",
        build: {
            outDir: "../target/asset-build/",
            rollupOptions: {
                output: {
                    assetFileNames: (chunkInfo) => {
                        // Get rid of the hash so we can consistently reference these
                        // files in our `package.json` `exports`. And so people can
                        // import them with a consistent path.
                        if (
                            pathsToExport.includes(
                                path.basename(chunkInfo.name)
                            )
                        ) {
                            return "assets/[name].[ext]";
                        }

                        return "assets/[name]-[hash][extname]";
                    },
                },
            },
        },
        plugins: [
            themeBuilder({
                themeConfig: {
                    themes: ["./src/platform/web/ui/css/themes/element"],
                    default: "element",
                },
                compiledVariables,
            }),
        ],
    });
});
