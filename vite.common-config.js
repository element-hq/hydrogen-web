const cssvariables = require("postcss-css-variables");
const flexbugsFixes = require("postcss-flexbugs-fixes");
const fs = require("fs");
const path = require("path");
const manifest = require("./package.json");
const version = manifest.version;

const commonOptions = {
    logLevel: "info",
    publicDir: false,
    server: {
        hmr: false
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
