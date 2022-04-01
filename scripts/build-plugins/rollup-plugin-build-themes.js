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

async function readCSSSource(location) {
    const fs = require("fs").promises;
    const path = require("path");
    const resolvedLocation = path.resolve(__dirname, "../../",  `${location}/theme.css`);
    const data = await fs.readFile(resolvedLocation);
    return data;
}

async function appendVariablesToCSS(variables, cssSource) {
    return cssSource + `:root{\n${Object.entries(variables).reduce((acc, [key, value]) => acc + `--${key}: ${value};\n`, "")} }\n\n`;
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

    return {
        name: "build-themes",
        enforce: "pre",

        async buildStart() {
            const { manifestLocations } = options;
            for (const location of manifestLocations) {
                manifest = require(`${location}/manifest.json`);
                variants = manifest.values.variants;
                const themeName = manifest.name;
                for (const [variant, details] of Object.entries(variants)) {
                    const fileName = `theme-${themeName}-${variant}.css`;
                    if (details.default) {
                        // This theme is the default for when Hydrogen launches for the first time
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
                        id: `${location}/theme.css?variant=${variant}`,
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

        async load(id) {
            const result = id.match(/(.+)\/theme.css\?variant=(.+)/);
            if (result) {
                const [, location, variant] = result;
                const cssSource = await readCSSSource(location);
                const config = variants[variant];
                return await appendVariablesToCSS(config.variables, cssSource);
            }
            return null;
        },

        transformIndexHtml(_, ctx) {
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
                const derivedVariables = options.compiledVariables.get(location)["derived-variables"];
                manifest.source = {
                    "built-asset": chunkArray.map(chunk => assetMap.get(chunk.fileName).fileName),
                    "runtime-asset": assetMap.get(runtimeThemeChunk.fileName).fileName,
                    "derived-variables": derivedVariables,
                };
                const name = `theme-${manifest.name}.json`;
                this.emitFile({
                    type: "asset",
                    name,
                    source: JSON.stringify(manifest),
                });
            }
        }
    }
}
