const path = require("path");
const mergeOptions = require('merge-options');
const commonOptions = require("./vite.common-config.js");
const manifest = require("./package.json")

// const srcDir = path.join(__dirname, "src/");
// const modulesDir = path.join(srcDir, "node_modules/");
// const mocksDir = path.join(srcDir, "mocks/");
// const fixturesDir = path.join(srcDir, "fixtures/");

const externalDependencies = Object.keys(manifest.dependencies)
    .concat(Object.keys(manifest.devDependencies))
    .map(d => path.join(__dirname, "node_modules", d));

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
            external(id, parentId) {
                const isRelativePath = id.startsWith("./") || id.startsWith("../");
                const isModuleIdentifier = !isRelativePath && !id.startsWith("/");
                const resolveId = isRelativePath ? path.join(path.dirname(parentId), id) : id;
                const external = isModuleIdentifier ||
                    externalDependencies.some(d => resolveId.startsWith(d));
                    // resolveId.startsWith(fixturesDir) ||
                    // resolveId.startsWith(mocksDir);
                return external;
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
