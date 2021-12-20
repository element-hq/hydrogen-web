const path = require("path");
const mergeOptions = require('merge-options');
const commonOptions = require("./vite.common-config.js");

export default mergeOptions(commonOptions, {
    root: "src/",
    base: "./",
    build: {
        outDir: "../target/asset-build/",
    },
});
