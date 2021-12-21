const path = require("path");
const mergeOptions = require('merge-options');
const commonOptions = require("./vite.common-config.js");
const manifest = require("./package.json");

const externalDependencies = Object.keys(manifest.dependencies)
    // just in case for safety in case fake-indexeddb wouldn't be
    // treeshake'd out of the bundle
    .concat(Object.keys(manifest.devDependencies))
    // bundle bs58 because it uses buffer indirectly, which is a pain to bundle,
    // so we don't annoy our library users with it.
    .filter(d => d !== "bs58");
const moduleDir = path.join(__dirname, "node_modules");

export default mergeOptions(commonOptions, {
    root: "src/",
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/lib.ts'),
            formats: ["cjs", "es"],
            fileName: format => `hydrogen.${format}.js`,
        },
        minify: false,
        sourcemap: false,
        outDir: "../target/lib-build",
        // don't bundle any dependencies, they should be imported/required
        rollupOptions: {
            external(id) {
                return externalDependencies.some(d => id === d || id.startsWith(d + "/"));
            },
            /* don't bundle, so we can override imports per file at build time to replace components */
            // output: {
            //     manualChunks: (id) => {
            //         if (id.startsWith(srcDir)) {
            //             const idPath = id.substring(srcDir.length);
            //             const pathWithoutExt = idPath.substring(0, idPath.lastIndexOf("."));
            //             return pathWithoutExt;
            //         } else {
            //             return "index";
            //         }
            //     },
            //     minifyInternalExports: false,
            //     chunkFileNames: "[format]/[name].js"
            // }
        }
    },
});
