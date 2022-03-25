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

module.exports = function buildThemes(options) {
    let manifest, variants;

    return {
        name: "build-themes",
        enforce: "pre",

        async buildStart() {
            const { manifestLocations } = options;
            for (const location of manifestLocations) {
                manifest = require(`${location}/manifest.json`);
                variants = manifest.values.variants;
                for (const [variant] of Object.entries(variants)) {
                    const themeName = manifest.name;
                    // emit the css as built theme bundle
                    this.emitFile({
                        type: "chunk",
                        id: `${location}/theme.css?variant=${variant}`,
                        fileName: `theme-${themeName}-${variant}.css`,
                    });
                }
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
    }
}
