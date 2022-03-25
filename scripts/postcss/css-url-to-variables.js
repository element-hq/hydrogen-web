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
 * This plugin extracts content inside url() into css variables.
 * The extracted css variables are added to the :root section.
 */
let counter;
let urlVariables;
const idToPrepend = "icon-url";

function extractUrl(decl) {
    const value = decl.value;
    const parsed = valueParser(value);
    parsed.walk(node => {
        if (node.type !== "function" || node.value !== "url") {
            return;
        }
        const urlStringNode = node.nodes[0];
        const variableName = `${idToPrepend}-${counter++}`;
        urlVariables.set(variableName, urlStringNode.value);
        const varNode = {
            type: "function",
            value: "var",
            nodes: [{ type: "word", value: `--${variableName}` }],
        };
        // replace the url-string node with this var-node
        node.nodes[0] = varNode;
    });
    decl.assign({prop: decl.prop, value: parsed.toString()})
}

function addResolvedVariablesToRootSelector(root, { Rule, Declaration }) {
    const newRule = new Rule({ selector: ":root", source: root.source });
    // Add derived css variables to :root
    urlVariables.forEach((value, key) => {
        const declaration = new Declaration({ prop: `--${key}`, value: `"${value}"`});
        newRule.append(declaration);
    });
    root.append(newRule);
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
            root.walkDecls(decl => extractUrl(decl));
            addResolvedVariablesToRootSelector(root, { Rule, Declaration });
        },
    };
};

module.exports.postcss = true;

