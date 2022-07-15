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
 * This plugin derives new css variables from a given set of base variables.
 * A derived css variable has the form --base--operation-argument; meaning that the derived
 * variable has a value that is generated from the base variable "base" by applying "operation"
 * with given "argument".
 * 
 * eg: given the base variable --foo-color: #40E0D0, --foo-color--darker-20 is a css variable
 * derived from foo-color by making it 20% more darker.
 * 
 * All derived variables are added to the :root section.
 * 
 * The actual derivation is done outside the plugin in a callback.
 */

function getValueFromAlias(alias, {aliasMap, baseVariables, resolvedMap}) {
    const derivedVariable = aliasMap.get(alias);
    return baseVariables.get(derivedVariable) ?? resolvedMap.get(derivedVariable);
}

function parseDeclarationValue(value) {
    const parsed = valueParser(value);
    const variables = [];
    parsed.walk(node => {
        if (node.type !== "function") {
            return;
        }
        switch (node.value) {
            case "var": {
                const variable = node.nodes[0];
                variables.push(variable.value);
                break;
            }
            case "url": {
                const url = node.nodes[0].value;
                // resolve url with some absolute url so that we get the query params without using regex
                const params = new URL(url, "file://foo/bar/").searchParams;
                const primary = params.get("primary");
                const secondary = params.get("secondary");
                if (primary) { variables.push(primary); }
                if (secondary) { variables.push(secondary); }
                break;
            }
        }
    });
    return variables;
}

function resolveDerivedVariable(decl, derive, maps, isDark) {
    const { baseVariables, resolvedMap } = maps;
    const RE_VARIABLE_VALUE = /(?:--)?((.+)--(.+)-(.+))/;
    const variableCollection = parseDeclarationValue(decl.value);
    for (const variable of variableCollection) {
        const matches = variable.match(RE_VARIABLE_VALUE);
        if (matches) {
            const [, wholeVariable, baseVariable, operation, argument] = matches;
            const value = baseVariables.get(baseVariable) ?? getValueFromAlias(baseVariable, maps);
            if (!value) {
                throw new Error(`Cannot derive from ${baseVariable} because it is neither defined in config nor is it an alias!`);
            }
            const derivedValue = derive(value, operation, argument, isDark);
            resolvedMap.set(wholeVariable, derivedValue);
        }
    }
}

function extract(decl, {aliasMap, baseVariables}) {
    if (decl.variable) {
        // see if right side is of form "var(--foo)"
        const wholeVariable = decl.value.match(/var\(--(.+)\)/)?.[1];
        // remove -- from the prop
        const prop = decl.prop.substring(2);
        if (wholeVariable) {
            aliasMap.set(prop, wholeVariable);
            // Since this is an alias, we shouldn't store it in baseVariables
            return;
        }
        baseVariables.set(prop, decl.value);
    }
}

function addResolvedVariablesToRootSelector(root, {Rule, Declaration}, {resolvedMap}) {
    const newRule = new Rule({ selector: ":root", source: root.source });
    // Add derived css variables to :root
    resolvedMap.forEach((value, key) => {
        const declaration = new Declaration({prop: `--${key}`, value});
        newRule.append(declaration);
    });
    root.append(newRule);
}

function populateMapWithDerivedVariables(map, cssFileLocation, {resolvedMap, aliasMap}) {
    const location = cssFileLocation.match(/(.+)\/.+\.css/)?.[1];
    const derivedVariables = [
        ...([...resolvedMap.keys()].filter(v => !aliasMap.has(v))),
        ...([...aliasMap.entries()].map(([alias, variable]) => `${alias}=${variable}`))
    ];
    map.set(location, { "derived-variables": derivedVariables });
}

/**
 * @callback derive
 * @param {string} value - The base value on which an operation is applied
 * @param {string} operation - The operation to be applied (eg: darker, lighter...)
 * @param {string} argument - The argument for this operation
 * @param {boolean} isDark - Indicates whether this theme is dark
 */
/**
 * 
 * @param {Object} opts - Options for the plugin
 * @param {derive} opts.derive - The callback which contains the logic for resolving derived variables
 * @param {Map} opts.compiledVariables - A map that stores derived variables so that manifest source sections can be produced
 */
module.exports = (opts = {}) => {
    const aliasMap = new Map();
    const resolvedMap = new Map();
    const baseVariables = new Map();
    const maps = { aliasMap, resolvedMap, baseVariables };

    return {
        postcssPlugin: "postcss-compile-variables",

        Once(root, {Rule, Declaration, result}) {
            const cssFileLocation = root.source.input.from;
            if (cssFileLocation.includes("type=runtime")) {
                // If this is a runtime theme, don't derive variables.
                return;
            }
            const isDark = cssFileLocation.includes("dark=true");
            /*
            Go through the CSS file once to extract all aliases and base variables.
            We use these when resolving derived variables later.
            */
            root.walkDecls(decl => extract(decl, maps));
            root.walkDecls(decl => resolveDerivedVariable(decl, opts.derive, maps, isDark));
            addResolvedVariablesToRootSelector(root, {Rule, Declaration}, maps);
            if (opts.compiledVariables){
                populateMapWithDerivedVariables(opts.compiledVariables, cssFileLocation, maps);
            }
            // Also produce a mapping from alias to completely resolved color
            const resolvedAliasMap = new Map();
            aliasMap.forEach((value, key) => {
                resolvedAliasMap.set(key, resolvedMap.get(value));
            });
            // Publish the base-variables, derived-variables and resolved aliases to the other postcss-plugins
            const combinedMap = new Map([...baseVariables, ...resolvedMap, ...resolvedAliasMap]);
            result.messages.push({
                type: "resolved-variable-map",
                plugin: "postcss-compile-variables",
                colorMap: combinedMap,
            });
        },
    };
};

module.exports.postcss = true;
