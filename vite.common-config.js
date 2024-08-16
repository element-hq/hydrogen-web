const {
    createPlaceholderValues,
} = require("./scripts/build-plugins/service-worker");
const flexbugsFixes = require("postcss-flexbugs-fixes");
const compileVariables = require("./scripts/postcss/css-compile-variables");
const urlVariables = require("./scripts/postcss/css-url-to-variables");
const urlProcessor = require("./scripts/postcss/css-url-processor");
const appManifest = require("./package.json");
const sdkManifest = require("./scripts/sdk/base-manifest.json");
const compiledVariables = new Map();
import { buildColorizedSVG as replacer } from "./scripts/postcss/svg-builder.mjs";
import { derive } from "./src/platform/web/theming/shared/color.mjs";

const commonOptions = (mode) => {
    const definePlaceholders = createPlaceholderValues(mode);
    return {
        logLevel: "warn",
        publicDir: false,
        server: {
            hmr: false,
        },
        resolve: {
            alias: {
                // these should only be imported by the base-x package in any runtime code
                // and works in the browser with a Uint8Array shim,
                // rather than including a ton of polyfill code
                "safe-buffer":
                    "./scripts/package-overrides/safe-buffer/index.js",
                buffer: "./scripts/package-overrides/buffer/index.js",
            },
        },
        build: {
            emptyOutDir: true,
            assetsInlineLimit: 0,
            polyfillModulePreload: false,
        },
        assetsInclude: ["**/config.json"],
        define: Object.assign(
            {
                DEFINE_VERSION: `"${getVersion(mode)}"`,
                DEFINE_GLOBAL_HASH: JSON.stringify(null),
                DEFINE_IS_SDK: mode === "sdk" ? "true" : "false",
                DEFINE_PROJECT_DIR: JSON.stringify(__dirname),
            },
            definePlaceholders
        ),
        css: {
            postcss: {
                plugins: [
                    compileVariables({ derive, compiledVariables }),
                    urlVariables({ compiledVariables }),
                    urlProcessor({ replacer }),
                    flexbugsFixes(),
                ],
            },
        },
    };
};

/**
 * Get the version for this build
 * @param mode Vite mode for this build
 * @returns string representing version
 */
function getVersion(mode) {
    if (mode === "production") {
        // This is an app build, so return the version from root/package.json
        return appManifest.version;
    } else if (mode === "sdk") {
        // For the sdk build, return version from base-manifest.json
        return sdkManifest.version;
    } else {
        // For the develop server
        return "develop";
    }
}

module.exports = { commonOptions, compiledVariables };
