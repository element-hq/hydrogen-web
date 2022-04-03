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

/**
 * This plugin extracts content inside url() into css variables and adds the variables to the root section.
 * This plugin is used in conjunction with css-url-processor plugin to colorize svg icons.
 */
let counter;
let urlVariables;
const idToPrepend = "icon-url";

function findAndReplaceUrl(decl) {
    const value = decl.value;
    const parsed = valueParser(value);
    parsed.walk(node => {
        if (node.type !== "function" || node.value !== "url") {
            return;
        }
        const url = node.nodes[0].value;
        if (!url.match(/\.svg\?primary=.+/)) {
            return;
        }
        const variableName = `${idToPrepend}-${counter++}`;
        urlVariables.set(variableName, url);
        node.value = "var";
        node.nodes = [{ type: "word", value: `--${variableName}` }];
    });
    decl.assign({prop: decl.prop, value: parsed.toString()})
}

function addResolvedVariablesToRootSelector(root, { Rule, Declaration }) {
    const newRule = new Rule({ selector: ":root", source: root.source });
    // Add derived css variables to :root
    urlVariables.forEach((value, key) => {
        const declaration = new Declaration({ prop: `--${key}`, value: `url("${value}")`});
        newRule.append(declaration);
    });
    root.append(newRule);
}

function populateMapWithDerivedVariables(map, cssFileLocation) {
    const location = cssFileLocation.match(/(.+)\/.+\.css/)?.[1];
    if (map.has(location)) {
        /**
         * This postcss plugin is going to run on all theme variants of a single theme.
         * But we only really need to populate the map once since theme variants only differ
         * by the values of the base-variables and we don't care about values here.
         */
        return;
    }
    map.set(location, { "icon": Object.fromEntries(urlVariables) });
}

/* *
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts = {}) => {
    urlVariables = new Map();
    counter = 0;
    return {
        postcssPlugin: "postcss-url-to-variable",

        Once(root, { Rule, Declaration }) {
            root.walkDecls(decl => findAndReplaceUrl(decl));
            if (urlVariables.size) {
                addResolvedVariablesToRootSelector(root, { Rule, Declaration });
            }
            if (opts.compiledVariables){
                const cssFileLocation = root.source.input.from;
                populateMapWithDerivedVariables(opts.compiledVariables, cssFileLocation);
            }
        },
    };
};

module.exports.postcss = true;

