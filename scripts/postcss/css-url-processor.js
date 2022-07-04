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

const valueParser = require("postcss-value-parser");
const  resolve = require("path").resolve;

function colorsFromURL(url, colorMap) {
    const params = new URL(`file://${url}`).searchParams;
    const primary = params.get("primary");
    if (!primary) {
        return null;
    }
    const secondary = params.get("secondary");
    const primaryColor = colorMap.get(primary);
    const secondaryColor = colorMap.get(secondary);
    if (!primaryColor) {
        throw new Error(`Variable ${primary} not found in resolved color variables!`);
    }
    if (secondary && !secondaryColor) {
        throw new Error(`Variable ${secondary} not found in resolved color variables!`);
    }
    return [primaryColor, secondaryColor];
}

function processURL(decl, replacer, colorMap, cssPath) {
    const value = decl.value;
    const parsed = valueParser(value);
    parsed.walk(node => {
        if (node.type !== "function" || node.value !== "url") {
            return;
        }
        const urlStringNode = node.nodes[0];
        const oldURL = urlStringNode.value;
        const oldURLAbsolute = resolve(cssPath, oldURL);
        const colors  = colorsFromURL(oldURLAbsolute, colorMap);
        if (!colors) {
            // If no primary color is provided via url params, then this url need not be handled.
            return;
        }
        const newURL = replacer(oldURLAbsolute.replace(/\?.+/, ""), ...colors);
        if (!newURL) {
            throw new Error("Replacer failed to produce a replacement URL!");
        }
        urlStringNode.value = newURL;
    });
    decl.assign({prop: decl.prop, value: parsed.toString()})
}

/* *
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts = {}) => {
    return {
        postcssPlugin: "postcss-url-to-variable",

        Once(root, {result}) {
            const cssFileLocation = root.source.input.from;
            if (cssFileLocation.includes("type=runtime")) {
                // If this is a runtime theme, don't process urls.
                return;
            }
            /*
            postcss-compile-variables should have sent the list of resolved colours down via results
            */
            const {colorMap} = result.messages.find(m => m.type === "resolved-variable-map");
            if (!colorMap) {
                throw new Error("Postcss results do not contain resolved colors!");
            }
            /*
            Go through each declaration and if it contains an URL, replace the url with the result
            of running replacer(url)
            */
            const cssPath = root.source?.input.file.replace(/[^/]*$/, "");
            root.walkDecls(decl => processURL(decl, opts.replacer, colorMap, cssPath));
        },
    };
};

module.exports.postcss = true;
