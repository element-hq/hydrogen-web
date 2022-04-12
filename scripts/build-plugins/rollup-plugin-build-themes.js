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
const path = require('path');

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

function findLocationFromThemeName(name, locations) {
    const themeLocation = locations.find(location => {
        const manifest = require(`${location}/manifest.json`);
        if (manifest.name === name) {
            return true;
        }
    });
    if (!themeLocation) {
        throw new Error(`Cannot find location from theme name "${name}"`);
    }
    return themeLocation;
}

function findManifestFromThemeName(name, locations) {
    for (const location of locations) {
        const manifest = require(`${location}/manifest.json`);
        if (manifest.name === name) {
            return manifest;
        }
    }
    throw new Error(`Cannot find manifest from theme name "${name}"`);
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
    let manifest, variants, defaultDark, defaultLight;
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
            const { manifestLocations } = options;
            for (const location of manifestLocations) {
                manifest = require(`${location}/manifest.json`);
                variants = manifest.values.variants;
                const themeName = manifest.name;
                for (const [variant, details] of Object.entries(variants)) {
                    const fileName = `theme-${themeName}-${variant}.css`;
                    if (details.default) {
                        // This is one of the default variants for this theme.
                        if (details.dark) {
                            defaultDark = fileName;
                        }
                        else {
                            defaultLight = fileName;
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
                    fileName: `theme-${themeName}-runtime.css`,
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
                if (id.startsWith(resolvedVirtualModuleId)) {
                    let [theme, variant, file] = id.substr(resolvedVirtualModuleId.length).split("/");
                    if (theme === "default") {
                        theme = "Element";
                    }
                    if (!variant || variant === "default") {
                        variant = "light";
                    }
                    if (!file) {
                        file = "index.js";
                    }
                    switch (file) {
                        case "index.js": {
                            const location = findLocationFromThemeName(theme, options.manifestLocations);
                            const manifest = findManifestFromThemeName(theme, options.manifestLocations);
                            const isDark = manifest.values.variants[variant].dark;
                            return `import "${path.resolve(`${location}/theme.css`)}${isDark? "?dark=true": ""}";` +
                                `import "@theme/${theme}/${variant}/variables.css"`;
                        }
                        case "variables.css": { 
                            const manifest = findManifestFromThemeName(theme, options.manifestLocations);
                            const variables = manifest.values.variants[variant].variables;
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
                    return await appendVariablesToCSS(config.variables, cssSource);
                }
                return null;
            }
        },

        transform(code, id) {
            if (isDevelopment) {
                return;
            }
            // Removes develop-only script tag; this cannot be done in transformIndexHtml hook.
            const devScriptTag = /<script type="module"> import "@theme\/.+"; <\/script>/;
            if (id.endsWith("index.html")) {
                const htmlWithoutDevScript = code.replace(devScriptTag, "");
                return htmlWithoutDevScript
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
                    }
                },
                {
                    tag: "link",
                    attrs: {
                        rel: "stylesheet",
                        type: "text/css",
                        media: "(prefers-color-scheme: light)",
                        href: `./${lightThemeLocation}`,
                    }
                },
            ];
},

        generateBundle(_, bundle) {
            const { assetMap, chunkMap, runtimeThemeChunk } = parseBundle(bundle);
            for (const [location, chunkArray] of chunkMap) {
                const manifest = require(`${location}/manifest.json`);
                const compiledVariables = options.compiledVariables.get(location);
                const derivedVariables = compiledVariables["derived-variables"];
                const icon = compiledVariables["icon"];
                manifest.source = {
                    "built-asset": chunkArray.map(chunk => assetMap.get(chunk.fileName).fileName),
                    "runtime-asset": assetMap.get(runtimeThemeChunk.fileName).fileName,
                    "derived-variables": derivedVariables,
                    "icon": icon
                };
                const name = `theme-${manifest.name}.json`;
                this.emitFile({
                    type: "asset",
                    name,
                    source: JSON.stringify(manifest),
                });
            }
        },
    }
}
