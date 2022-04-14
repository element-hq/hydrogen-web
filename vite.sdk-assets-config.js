const path = require("path");
const mergeOptions = require('merge-options');
const themeBuilder = require("./scripts/build-plugins/rollup-plugin-build-themes");
const {commonOptions, compiledVariables} = require("./vite.common-config.js");

export default mergeOptions(commonOptions, {
    root: "src/",
    base: "./",
    build: {
        outDir: "../target/asset-build/",
    },
    plugins: [
        themeBuilder({
            themeConfig: {
                themes: { element: "./src/platform/web/ui/css/themes/element" },
                default: "element",
            },
            compiledVariables,
        }),
    ],
});
