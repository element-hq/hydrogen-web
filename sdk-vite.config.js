const cssvariables = require("postcss-css-variables");
const flexbugsFixes = require("postcss-flexbugs-fixes");

const fs = require("fs");
const path = require("path");

const injectWebManifest = require("./scripts/build-plugins/manifest");
const injectServiceWorker = require("./scripts/build-plugins/service-worker");
// const legacyBuild = require("./scripts/build-plugins/legacy-build");

// we could also just import {version} from "../../package.json" where needed,
// but this won't work in the service worker yet as it is not transformed yet
// TODO: we should emit a chunk early on and then transform the asset again once we know all the other assets to cache
const version = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8")).version;
const {defineConfig} = require("vite");

const srcDir = path.join(__dirname, "src/");
const modulesDir = path.join(srcDir, "node_modules/");
const mocksDir = path.join(srcDir, "mocks/");
const fixturesDir = path.join(srcDir, "fixtures/");

export default {
    public: false,
    root: "src/",
    server: {
        hmr: false
    },
    resolve: {
        alias: {
            // these should only be imported by the base-x package in any runtime code
            // and works in the browser with a Uint8Array shim,
            // rather than including a ton of polyfill code
            "safe-buffer": "./scripts/package-overrides/safe-buffer/index.js",
            "buffer": "./scripts/package-overrides/buffer/index.js",
        }
    },
    build: {
        outDir: "../target",
        emptyOutDir: true,
        minify: false,
        sourcemap: false,
        assetsInlineLimit: 0,
        polyfillModulePreload: false,
        lib: {
            entry: "lib.ts",
            name: "hydrogen",
            formats: ["cjs", "es"]
        },
        rollupOptions: {
            external: id => id.startsWith(modulesDir) || id.startsWith(mocksDir) || id.startsWith(fixturesDir),
            output: {
                manualChunks: (id) => {
                    if (id.startsWith(srcDir)) {
                        const idPath = id.substring(srcDir.length);
                        const pathWithoutExt = idPath.substring(0, idPath.lastIndexOf("."));
                        return pathWithoutExt;
                    } else {
                        console.log("putting", id.substring(srcDir.length), "in index");
                        return "index";
                    }
                },
                chunkFileNames: `[format]/[name].js`,
                // preserveModules: true,
            }
        }
    },
    define: {
        "DEFINE_VERSION": JSON.stringify(version)
    },
    css: {
        postcss: {
            plugins: [
                cssvariables({
                    preserve: (declaration) => {
                        return declaration.value.indexOf("var(--ios-") == 0;
                    }
                }),
                // the grid option creates some source fragment that causes the vite warning reporter to crash because
                // it wants to log a warning on a line that does not exist in the source fragment.
                // autoprefixer({overrideBrowserslist: ["IE 11"], grid: "no-autoplace"}),
                flexbugsFixes()
            ]
        }
    }
};

function scriptTagPath(htmlFile, index) {
    return `${htmlFile}?html-proxy&index=${index}.js`;
}
