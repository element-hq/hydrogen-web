/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const valueParser = require("postcss-value-parser");

/**
 * This plugin extracts content inside url() into css variables and adds the variables to the root section.
 * This plugin is used in conjunction with css-url-processor plugin to colorize svg icons.
 */
const idToPrepend = "icon-url";

function findAndReplaceUrl(decl, urlVariables, counter) {
    const value = decl.value;
    let parsed;
    try {
        parsed = valueParser(value);
    } catch (err) {
        console.log(`Error trying to parse ${decl}`);
        throw err;
    }
    parsed.walk(node => {
        if (node.type !== "function" || node.value !== "url") {
            return;
        }
        const url = node.nodes[0].value;
        if (!url.match(/\.svg\?primary=.+/)) {
            return;
        }
        const count = counter.next().value;
        const variableName = `${idToPrepend}-${count}`;
        urlVariables.set(variableName, url);
        node.value = "var";
        node.nodes = [{ type: "word", value: `--${variableName}` }];
    });
    decl.assign({prop: decl.prop, value: parsed.toString()})
}

function addResolvedVariablesToRootSelector(root, { Rule, Declaration }, urlVariables) {
    const newRule = new Rule({ selector: ":root", source: root.source });
    // Add derived css variables to :root
    urlVariables.forEach((value, key) => {
        const declaration = new Declaration({ prop: `--${key}`, value: `url("${value}")`});
        newRule.append(declaration);
    });
    root.append(newRule);
}

function populateMapWithIcons(map, cssFileLocation, urlVariables) {
    const location = cssFileLocation.match(/(.+)\/.+\.css/)?.[1];
    const sharedObject = map.get(location);
    const output = {"icon": Object.fromEntries(urlVariables)};
    if (sharedObject) {
        Object.assign(sharedObject, output);
    }
    else {
        map.set(location, output);
    }
}

function *createCounter() {
    for (let i = 0; ; ++i) {
        yield i;
    }
}

/* *
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts = {}) => {
    return {
        postcssPlugin: "postcss-url-to-variable",

        Once(root, { Rule, Declaration }) {
            const urlVariables = new Map();
            const counter = createCounter();
            root.walkDecls(decl => findAndReplaceUrl(decl, urlVariables, counter));
            const cssFileLocation = root.source.input.from;
            if (urlVariables.size && !cssFileLocation.includes("type=runtime")) {
                addResolvedVariablesToRootSelector(root, { Rule, Declaration }, urlVariables);
            }
            if (opts.compiledVariables){
                const cssFileLocation = root.source.input.from;
                populateMapWithIcons(opts.compiledVariables, cssFileLocation, urlVariables);
            }
        },
    };
};

module.exports.postcss = true;

