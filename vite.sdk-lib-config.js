const path = require("path");
const { defineConfig } = require("vite");
const mergeOptions = require("merge-options").bind({ concatArrays: true });
const { commonOptions } = require("./vite.common-config.js");
const manifest = require("./package.json");
const {
    injectServiceWorker,
    createPlaceholderValues,
} = require("./scripts/build-plugins/service-worker");

const externalDependencies = Object.keys(manifest.dependencies)
    // just in case for safety in case fake-indexeddb wouldn't be
    // treeshake'd out of the bundle
    .concat(Object.keys(manifest.devDependencies))
    // bundle bs58 because it uses buffer indirectly, which is a pain to bundle,
    // so we don't annoy our library users with it.
    .filter((d) => d !== "bs58");

export default defineConfig(({ mode }) => {
    const options = commonOptions(mode);
    const definePlaceholders = createPlaceholderValues(mode);
    return mergeOptions(options, {
        root: "src/",
        plugins: [
            injectServiceWorker("./src/platform/web/sw.js", () => [], {
                lib: {
                    DEFINE_GLOBAL_HASH: definePlaceholders.DEFINE_GLOBAL_HASH,
                },
                sw: definePlaceholders,
            }),
        ],
        build: {
            lib: {
                entry: path.resolve(__dirname, "src/lib.ts"),
                formats: ["cjs", "es"],
                fileName: (format) => `hydrogen.${format}.js`,
            },
            minify: false,
            sourcemap: false,
            outDir: "../target/lib-build",
            // don't bundle any dependencies, they should be imported/required
            rollupOptions: {
                external(id) {
                    return externalDependencies.some(
                        (d) => id === d || id.startsWith(d + "/")
                    );
                },
            },
        },
    });
});
