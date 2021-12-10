const path = require("path");
const mergeOptions = require('merge-options').bind({concatArrays: true});
const commonOptions = require("./vite.common-config.js");

const srcDir = path.join(__dirname, "src/");
const modulesDir = path.join(srcDir, "node_modules/");
const mocksDir = path.join(srcDir, "mocks/");
const fixturesDir = path.join(srcDir, "fixtures/");


export default mergeOptions(commonOptions, {
    root: "src/",
    build: {
        outDir: "../target",
        lib: {
            entry: "lib.ts",
            fileName: "hydrogen",
            formats: ["cjs", "es"]
        },
        rollupOptions: {
            external: (id, parentId) => {
                const resolveId = (id.startsWith("./") || id.startsWith("../")) ? path.join(path.dirname(parentId), id) : id;
                return !resolveId.startsWith(srcDir) || resolveId.startsWith(mocksDir) || resolveId.startsWith(fixturesDir);
            },
            output: {
                manualChunks: (id) => {
                    if (id.startsWith(srcDir)) {
                        const idPath = id.substring(srcDir.length);
                        const pathWithoutExt = idPath.substring(0, idPath.lastIndexOf("."));
                        return pathWithoutExt;
                    } else {
                        return "index";
                    }
                },
                chunkFileNames: `[format]/[name].js`,
                // important to preserve export names of every module
                // so we can still override the file and provider alternative impls
                minifyInternalExports: false,
                preferConst: true,
            }
        }
    },
});
