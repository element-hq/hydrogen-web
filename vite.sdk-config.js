const path = require("path");
const mergeOptions = require('merge-options').bind({concatArrays: true});
const commonOptions = require("./vite.common-config.js");
const manifest = require("./package.json");

const srcDir = path.join(__dirname, "src/");
const modulesDir = path.join(srcDir, "node_modules/");
const mocksDir = path.join(srcDir, "mocks/");
const fixturesDir = path.join(srcDir, "fixtures/");

const commonOutput = {
    // manualChunks: (id) => {
    //     if (id.endsWith("/lib.ts")) {
    //         console.log(id, arguments);
    //         return "es/lib";
    //     }
    //     if (id.startsWith(srcDir)) {
    //         const idPath = id.substring(srcDir.length);
    //         const pathWithoutExt = idPath.substring(0, idPath.lastIndexOf("."));
    //         return pathWithoutExt;
    //     } else {
    //         return "index";
    //     }
    // },
    chunkFileNames: `[format]/[name].js`,
    assetFileNames: `assets/[name][extname]`,
    // important to preserve export names of every module
    // so we can still override the file and provider alternative impls
    minifyInternalExports: false,
    preferConst: true,
};

const externalDependencies = Object.keys(manifest.dependencies).concat(Object.keys(manifest.devDependencies)).filter(d => d !== "@matrix-org/olm").map(d => path.join(__dirname, "node_modules", d));
console.log("external", externalDependencies);

export default mergeOptions(commonOptions, {
    root: "src/",
    plugins: [
        {
            name: "showconfig",
            buildStart(rollupOptions) {
                console.dir(rollupOptions, {depth: 100});
            },
            resolveId(source, importer) {
                console.log(source, importer);
            }
        }
    ],
    build: {
        minify: false,
        sourcemap: false,
        outDir: "../target",
        rollupOptions: {
            input: "./src/lib.ts",
            treeshake: false,
            external: (id, parentId) => {
                const resolveId = (id.startsWith("./") || id.startsWith("../")) ? path.join(path.dirname(parentId), id) : id;
                const external = externalDependencies.some(d => resolveId.startsWith(d));
                if (external) {
                    console.log("external", resolveId);
                }
                return external;
                //return !resolveId.startsWith(srcDir);// || resolveId.startsWith(mocksDir) || resolveId.startsWith(fixturesDir);
            },
            preserveEntrySignatures: "strict",
            output: [
                Object.assign({}, commonOutput, {format: "es"}),
                Object.assign({}, commonOutput, {format: "cjs"}),
            ]
        }
    },
});
