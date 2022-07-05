/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const path = require('path').posix;

async function readCSSSource(location) {
    const fs = require("fs").promises;
    const path = require("path");
    const resolvedLocation = path.resolve(__dirname, "../../", `${location}/theme.css`);
    const data = await fs.readFile(resolvedLocation);
    return data;
}

function getRootSectionWithVariables(variables) {
    return `:root{\n${Object.entries(variables).reduce((acc, [key, value]) => acc + `--${key}: ${value};\n`, "")} }\n\n`;
}

function appendVariablesToCSS(variables, cssSource) {
    return cssSource + getRootSectionWithVariables(variables);
}

function addThemesToConfig(bundle, manifestLocations, defaultThemes) {
    for (const [fileName, info] of Object.entries(bundle)) {
        if (fileName === "config.json") {
            const source = new TextDecoder().decode(info.source);
            const config = JSON.parse(source);
            config["themeManifests"] = manifestLocations;
            config["defaultTheme"] = defaultThemes;
            info.source = new TextEncoder().encode(JSON.stringify(config, undefined, 2));
        }
    }
}

function parseBundle(bundle) {
    const chunkMap = new Map();
    const assetMap = new Map();
    let runtimeThemeChunk;
    for (const [fileName, info] of Object.entries(bundle)) {
        if (!fileName.endsWith(".css")) {
            continue;
        }
        if (info.type === "asset") {
            /**
             * So this is the css assetInfo that contains the asset hashed file name.
             * We'll store it in a separate map indexed via fileName (unhashed) to avoid
             * searching through the bundle array later.
             */
            assetMap.set(info.name, info);
            continue;
        }
        if (info.facadeModuleId?.includes("type=runtime")) {
            /**
             * We have a separate field in manifest.source just for the runtime theme,
             * so store this separately.
             */
            runtimeThemeChunk = info;
            continue;
        }
        const location = info.facadeModuleId?.match(/(.+)\/.+\.css/)?.[1];
        if (!location) {
            throw new Error("Cannot find location of css chunk!");
        }
        const array = chunkMap.get(location);
        if (!array) {
            chunkMap.set(location, [info]);
        }
        else {
            array.push(info);
        }
    }
    return { chunkMap, assetMap, runtimeThemeChunk };
}

module.exports = function buildThemes(options) {
    let manifest, variants, defaultDark, defaultLight, defaultThemes = {};
    let isDevelopment = false;
    const virtualModuleId = '@theme/'
    const resolvedVirtualModuleId = '\0' + virtualModuleId;

    return {
        name: "build-themes",
        enforce: "pre",

        configResolved(config) {
            if (config.command === "serve") {
                isDevelopment = true;
            }
        },

        async buildStart() {
            if (isDevelopment) { return; }
            const { themeConfig } = options;
            for (const [name, location] of Object.entries(themeConfig.themes)) {
                manifest = require(`${location}/manifest.json`);
                variants = manifest.values.variants;
                for (const [variant, details] of Object.entries(variants)) {
                    const fileName = `theme-${name}-${variant}.css`;
                    if (name === themeConfig.default && details.default) {
                        // This is the default theme, stash  the file name for later
                        if (details.dark) {
                            defaultDark = fileName;
                            defaultThemes["dark"] = `${name}-${variant}`;
                        }
                        else {
                            defaultLight = fileName;
                            defaultThemes["light"] = `${name}-${variant}`;
                        }
                    }
                    // emit the css as built theme bundle
                    this.emitFile({
                        type: "chunk",
                        id: `${location}/theme.css?variant=${variant}${details.dark? "&dark=true": ""}`,
                        fileName,
                    });
                }
                // emit the css as runtime theme bundle
                this.emitFile({
                    type: "chunk",
                    id: `${location}/theme.css?type=runtime`,
                    fileName: `theme-${name}-runtime.css`,
                });
            }
        },

        resolveId(id) {
            if (id.startsWith(virtualModuleId)) {
                return '\0' + id;
            }
        },

        async load(id) {
            if (isDevelopment) {
                /**
                 * To load the theme during dev, we need to take a different approach because emitFile is not supported in dev.
                 * We solve this by resolving virtual file "@theme/name/variant" into the necessary css import.
                 * This virtual file import is removed when hydrogen is built (see transform hook).
                 */
                if (id.startsWith(resolvedVirtualModuleId)) {
                    let [theme, variant, file] = id.substr(resolvedVirtualModuleId.length).split("/");
                    if (theme === "default") {
                        theme = options.themeConfig.default;
                    }
                    const location = options.themeConfig.themes[theme];
                    const manifest = require(`${location}/manifest.json`);
                    const variants = manifest.values.variants;
                    if (!variant || variant === "default") {
                        // choose the first default variant for now
                        // this will need to support light/dark variants as well
                        variant = Object.keys(variants).find(variantName => variants[variantName].default);
                    }
                    if (!file) {
                        file = "index.js";
                    }
                    switch (file) {
                        case "index.js": {
                            const isDark = variants[variant].dark;
                            return `import "${path.resolve(`${location}/theme.css`)}${isDark? "?dark=true": ""}";` +
                                `import "@theme/${theme}/${variant}/variables.css"`;
                        }
                        case "variables.css": { 
                            const variables = variants[variant].variables;
                            const css =  getRootSectionWithVariables(variables);
                            return css;
                        }
                    }
                }
            }
            else {
                const result = id.match(/(.+)\/theme.css\?variant=([^&]+)/);
                if (result) {
                    const [, location, variant] = result;
                    const cssSource = await readCSSSource(location);
                    const config = variants[variant];
                    return appendVariablesToCSS(config.variables, cssSource);
                }
                return null;
            }
        },

        transform(code, id) {
            if (isDevelopment) {
                return;
            }
            /**
             * Removes develop-only script tag; this cannot be done in transformIndexHtml hook because
             * by the time that hook runs, the import is added to the bundled js file which would
             * result in a runtime error.
             */

            const devScriptTag =
                /<script type="module"> import "@theme\/.+"; <\/script>/;
            if (id.endsWith("index.html")) {
                const htmlWithoutDevScript = code.replace(devScriptTag, "");
                return htmlWithoutDevScript;
            }
        },

        transformIndexHtml(_, ctx) {
            if (isDevelopment) {
                // Don't add default stylesheets to index.html on dev
                return;
            } 
            let darkThemeLocation, lightThemeLocation;
            for (const [, bundle] of Object.entries(ctx.bundle)) {
                if (bundle.name === defaultDark) {
                    darkThemeLocation = bundle.fileName;
                }
                if (bundle.name === defaultLight) {
                    lightThemeLocation = bundle.fileName;
                }
            }
            return [
                {
                    tag: "link",
                    attrs: {
                        rel: "stylesheet",
                        type: "text/css",
                        media: "(prefers-color-scheme: dark)",
                        href: `./${darkThemeLocation}`,
                        class: "theme",
                    }
                },
                {
                    tag: "link",
                    attrs: {
                        rel: "stylesheet",
                        type: "text/css",
                        media: "(prefers-color-scheme: light)",
                        href: `./${lightThemeLocation}`,
                        class: "theme",
                    }
                },
            ];
},

        generateBundle(_, bundle) {
            // assetMap: Mapping from asset-name (eg: element-dark.css) to AssetInfo
            // chunkMap: Mapping from theme-location (eg: hydrogen-web/src/.../css/themes/element) to a list of ChunkInfo 
            // types of AssetInfo and ChunkInfo can be found at https://rollupjs.org/guide/en/#generatebundle
            const { assetMap, chunkMap, runtimeThemeChunk } = parseBundle(bundle);
            const manifestLocations = [];
            for (const [location, chunkArray] of chunkMap) {
                const manifest = require(`${location}/manifest.json`);
                const compiledVariables = options.compiledVariables.get(location);
                const derivedVariables = compiledVariables["derived-variables"];
                const icon = compiledVariables["icon"];
                const builtAssets = {};
                for (const chunk of chunkArray) {
                    const [, name, variant] = chunk.fileName.match(/theme-(.+)-(.+)\.css/);
                    builtAssets[`${name}-${variant}`] = assetMap.get(chunk.fileName).fileName;
                }
                manifest.source = {
                    "built-assets": builtAssets,
                    "runtime-asset": assetMap.get(runtimeThemeChunk.fileName).fileName,
                    "derived-variables": derivedVariables,
                    "icon": icon
                };
                const name = `theme-${manifest.name}.json`;
                manifestLocations.push(`assets/${name}`);
                this.emitFile({
                    type: "asset",
                    name,
                    source: JSON.stringify(manifest),
                });
            }
            addThemesToConfig(bundle, manifestLocations, defaultThemes);
        },
    }
}
