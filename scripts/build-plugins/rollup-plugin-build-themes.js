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
const {optimize} = require('svgo');

async function readCSSSource(location) {
    const fs = require("fs").promises;
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

/**
 * Returns an object where keys are the svg file names and the values
 * are the svg code (optimized)
 * @param {*} icons Object where keys are css variable names and values are locations of the svg
 * @param {*} manifestLocation Location of manifest used for resolving path 
 */
async function generateIconSourceMap(icons, manifestLocation) {
    const sources = {};
    const fileNames = [];
    const promises = [];
    const fs = require("fs").promises;
    for (const icon of Object.values(icons)) {
        const [location] = icon.split("?");
        // resolve location against manifestLocation
        const resolvedLocation = path.resolve(manifestLocation, location);
        const iconData = fs.readFile(resolvedLocation);
        promises.push(iconData);
        const fileName = path.basename(resolvedLocation);
        fileNames.push(fileName);
    }
    const results = await Promise.all(promises);
    for (let i = 0; i < results.length; ++i)  {
        const svgString = results[i].toString();
        const result = optimize(svgString, {
            plugins: [
                {
                    name: "preset-default",
                    params: {
                        overrides: { convertColors: false, },
                    },
                },
            ],
        });
        const optimizedSvgString = result.data;
        sources[fileNames[i]] = optimizedSvgString;
    }
    return sources;
}

/**
 * Returns a mapping from location (of manifest file) to an array containing all the chunks (of css files) generated from that location.
 * To understand what chunk means in this context, see https://rollupjs.org/guide/en/#generatebundle.
 * @param {*} bundle Mapping from fileName to AssetInfo | ChunkInfo
 */
function getMappingFromLocationToChunkArray(bundle) {
    const chunkMap = new Map();
    for (const [fileName, info] of Object.entries(bundle)) {
        if (!fileName.endsWith(".css") || info.type === "asset" || info.facadeModuleId?.includes("type=runtime")) {
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
    return chunkMap;
}

/**
 * Returns a mapping from unhashed file name (of css files) to AssetInfo.
 * To understand what AssetInfo means in this context, see https://rollupjs.org/guide/en/#generatebundle.
 * @param {*} bundle Mapping from fileName to AssetInfo | ChunkInfo 
 */
function getMappingFromFileNameToAssetInfo(bundle) {
    const assetMap = new Map();
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
        }
    }
    return assetMap;
}

/**
 * Returns a mapping from location (of manifest file) to ChunkInfo of the runtime css asset
 * To understand what ChunkInfo means in this context, see https://rollupjs.org/guide/en/#generatebundle.
 * @param {*} bundle Mapping from fileName to AssetInfo | ChunkInfo
 */
function getMappingFromLocationToRuntimeChunk(bundle) {
    let runtimeThemeChunkMap = new Map();
    for (const [fileName, info] of Object.entries(bundle)) {
        if (!fileName.endsWith(".css") || info.type === "asset") {
            continue;
        }
        const location = info.facadeModuleId?.match(/(.+)\/.+\.css/)?.[1];
        if (!location) {
            throw new Error("Cannot find location of css chunk!");
        }
        if (info.facadeModuleId?.includes("type=runtime")) {
            /**
             * We have a separate field in manifest.source just for the runtime theme,
             * so store this separately.
             */
            runtimeThemeChunkMap.set(location, info);
        }
    }
    return runtimeThemeChunkMap;
}

module.exports = function buildThemes(options) {
    let manifest, variants, defaultDark, defaultLight, defaultThemes = {};
    let isDevelopment = false;
    const virtualModuleId = '@theme/'
    const resolvedVirtualModuleId = '\0' + virtualModuleId;
    const themeToManifestLocation = new Map();

    return {
        name: "build-themes",
        enforce: "pre",

        configResolved(config) {
            if (config.command === "serve") {
                isDevelopment = true;
            }
        },

        async buildStart() {
            const { themeConfig } = options;
            for (const location of themeConfig.themes) {
                manifest = require(`${location}/manifest.json`);
                const themeCollectionId = manifest.id;
                themeToManifestLocation.set(themeCollectionId, location);
                variants = manifest.values.variants;
                for (const [variant, details] of Object.entries(variants)) {
                    const fileName = `theme-${themeCollectionId}-${variant}.css`;
                    if (themeCollectionId === themeConfig.default && details.default) {
                        // This is the default theme, stash  the file name for later
                        if (details.dark) {
                            defaultDark = fileName;
                            defaultThemes["dark"] = `${themeCollectionId}-${variant}`;
                        }
                        else {
                            defaultLight = fileName;
                            defaultThemes["light"] = `${themeCollectionId}-${variant}`;
                        }
                    }
                    // emit the css as built theme bundle
                    if (!isDevelopment) {
                        this.emitFile({ type: "chunk", id: `${location}/theme.css?variant=${variant}${details.dark ? "&dark=true" : ""}`, fileName, });
                    }
                }
                // emit the css as runtime theme bundle
                if (!isDevelopment) {
                    this.emitFile({ type: "chunk", id: `${location}/theme.css?type=runtime`, fileName: `theme-${themeCollectionId}-runtime.css`, });
                }
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
                    const location = themeToManifestLocation.get(theme);
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

        async generateBundle(_, bundle) {
            const assetMap = getMappingFromFileNameToAssetInfo(bundle);
            const chunkMap = getMappingFromLocationToChunkArray(bundle);
            const runtimeThemeChunkMap = getMappingFromLocationToRuntimeChunk(bundle);
            const manifestLocations = [];
            // Location of the directory containing manifest relative to the root of the build output
            const manifestLocation = "assets";
            for (const [location, chunkArray] of chunkMap) {
                const manifest = require(`${location}/manifest.json`);
                const compiledVariables = options.compiledVariables.get(location);
                const derivedVariables = compiledVariables["derived-variables"];
                const icon = compiledVariables["icon"];
                const builtAssets = {};
                let themeKey;
                for (const chunk of chunkArray) {
                    const [, name, variant] = chunk.fileName.match(/theme-(.+)-(.+)\.css/);
                    themeKey = name;
                    const locationRelativeToBuildRoot = assetMap.get(chunk.fileName).fileName;
                    const locationRelativeToManifest = path.relative(manifestLocation, locationRelativeToBuildRoot);
                    builtAssets[`${name}-${variant}`] = locationRelativeToManifest;
                }
                // Emit the base svg icons as asset
                const nameToAssetHashedLocation = [];
                const nameToSource = await generateIconSourceMap(icon, location);
                for (const [name, source] of Object.entries(nameToSource)) {
                    const ref = this.emitFile({ type: "asset", name, source });
                    const assetHashedName = this.getFileName(ref);
                    nameToAssetHashedLocation[name] = assetHashedName;
                }
                // Update icon section in output manifest with paths to the icon in build output 
                for (const [variable, location] of Object.entries(icon)) {
                    const [locationWithoutQueryParameters, queryParameters] = location.split("?");
                    const name = path.basename(locationWithoutQueryParameters);
                    const locationRelativeToBuildRoot = nameToAssetHashedLocation[name];
                    const locationRelativeToManifest = path.relative(manifestLocation, locationRelativeToBuildRoot);
                    icon[variable] = `${locationRelativeToManifest}?${queryParameters}`;
                }
                const runtimeThemeChunk = runtimeThemeChunkMap.get(location);
                const runtimeAssetLocation = path.relative(manifestLocation, assetMap.get(runtimeThemeChunk.fileName).fileName); 
                manifest.source = {
                    "built-assets": builtAssets,
                    "runtime-asset": runtimeAssetLocation,
                    "derived-variables": derivedVariables,
                    "icon": icon,
                };
                const name = `theme-${themeKey}.json`;
                manifestLocations.push(`${manifestLocation}/${name}`);
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
