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

let aliasMap;
let resolvedMap;
let baseVariables;

function getValueFromAlias(alias) {
    const derivedVariable = aliasMap.get(alias);
    return baseVariables.get(derivedVariable) ?? resolvedMap.get(derivedVariable);
}

function parseDeclarationValue(value) {
    const parsed = valueParser(value);
    const variables = [];
    parsed.walk(node => {
        if (node.type !== "function" && node.value !== "var") {
            return;
        }
        const variable = node.nodes[0];
        variables.push(variable.value);
    });
    return variables;
}

function resolveDerivedVariable(decl, derive) {
    const RE_VARIABLE_VALUE = /(--.+)--(.+)-(.+)/;
    const variableCollection = parseDeclarationValue(decl.value);
    for (const variable of variableCollection) {
        const matches = variable.match(RE_VARIABLE_VALUE);
        if (matches) {
            const [wholeVariable, baseVariable, operation, argument] = matches;
            const value = baseVariables.get(baseVariable) ?? getValueFromAlias(baseVariable);
            if (!value) {
                throw new Error(`Cannot derive from ${baseVariable} because it is neither defined in config nor is it an alias!`);
            }
            const derivedValue = derive(value, operation, argument);
            resolvedMap.set(wholeVariable, derivedValue);
        }
    }
}

function extract(decl) {
    if (decl.variable) {
        // see if right side is of form "var(--foo)"
        const wholeVariable = decl.value.match(/var\((--.+)\)/)?.[1];
        if (wholeVariable) {
            aliasMap.set(decl.prop, wholeVariable);
            // Since this is an alias, we shouldn't store it in baseVariables
            return;
        }
        baseVariables.set(decl.prop, decl.value);
    }
}

function addResolvedVariablesToRootSelector(root, {Rule, Declaration}) {
    const newRule = new Rule({ selector: ":root", source: root.source });
    // Add derived css variables to :root
    resolvedMap.forEach((value, key) => {
        const declaration = new Declaration({prop: key, value});
        newRule.append(declaration);
    });
    root.append(newRule);
}

/**
 * @callback derive
 * @param {string} value - The base value on which an operation is applied
 * @param {string} operation - The operation to be applied (eg: darker, lighter...)
 * @param {string} argument - The argument for this operation
 */
/**
 * 
 * @param {Object} opts - Options for the plugin
 * @param {derive} opts.derive - The callback which contains the logic for resolving derived variables
 */
module.exports = (opts = {}) => {
    aliasMap = new Map();
    resolvedMap = new Map();
    baseVariables = new Map();
    return {
        postcssPlugin: "postcss-compile-variables",

        Once(root, {Rule, Declaration}) {
            /*
            Go through the CSS file once to extract all aliases and base variables.
            We use these when resolving derived variables later.
            */
            root.walkDecls(decl => extract(decl));
            root.walkDecls(decl => resolveDerivedVariable(decl, opts.derive));
            addResolvedVariablesToRootSelector(root, {Rule, Declaration});
        },
    };
};

module.exports.postcss = true;
