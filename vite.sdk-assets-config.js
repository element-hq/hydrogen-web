const path = require("path");
const mergeOptions = require('merge-options');
const commonOptions = require("./vite.common-config.js");

const pathsToExport = [
    "main.js",
    "index.css",
    "download-sandbox.html"
];

export default mergeOptions(commonOptions, {
    root: "src/",
    base: "./",
    build: {
        outDir: "../target/asset-build/",
        rollupOptions: {
            output: {
              assetFileNames: (chunkInfo) => {
                  // Get rid of the hash so we can consistently reference these
                  // files in our `package.json` `exports`
                  if(pathsToExport.includes(path.basename(chunkInfo.name))) {
                    return "assets/[name].[ext]";
                  }

                return "assets/[name]-[hash][extname]";
              }
            }
        }
    },
});
