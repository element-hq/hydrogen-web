const cssvariables = require("postcss-css-variables");
const flexbugsFixes = require("postcss-flexbugs-fixes");
const fs = require("fs");
const path = require("path");
const manifest = require("./package.json");
const version = manifest.version;

const commonOptions = {
    logLevel: "warn",
    publicDir: false,
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
        emptyOutDir: true,
        assetsInlineLimit: 0,
        polyfillModulePreload: false,
    },
    define: {
        DEFINE_VERSION: JSON.stringify(version),
        DEFINE_GLOBAL_HASH: JSON.stringify(null),
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

module.exports = commonOptions;
