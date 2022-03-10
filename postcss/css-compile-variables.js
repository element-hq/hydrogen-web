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

function getValueFromAlias(alias, variables) {
    const derivedVariable = aliasMap.get(`--${alias}`);
    return variables[derivedVariable] ?? resolvedMap.get(`--${derivedVariable}`); // what if we haven't resolved this variable yet?
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

function resolveDerivedVariable(decl, {variables, derive}) {
    const RE_VARIABLE_VALUE = /--(.+)--(.+)-(.+)/;
    const variableCollection = parseDeclarationValue(decl.value);
    for (const variable of variableCollection) {
        const matches = variable.match(RE_VARIABLE_VALUE);
        if (matches) {
            const [wholeVariable, baseVariable, operation, argument] = matches;
            const value = variables[baseVariable] ?? getValueFromAlias(baseVariable, variables);
            if (!value) {
                throw new Error(`Cannot derive from ${baseVariable} because it is neither defined in config nor is it an alias!`);
            }
            const derivedValue = derive(value, operation, argument);
            resolvedMap.set(wholeVariable, derivedValue);
        }
    }
}

function extractAlias(decl) {
    if (decl.variable) {
        const wholeVariable = decl.value.match(/var\(--(.+)\)/)?.[1];
        if (wholeVariable) {
            aliasMap.set(decl.prop, wholeVariable);
        }
    }
}

function addResolvedVariablesToRootSelector(root, variables, {Rule, Declaration}) {
    const newRule = new Rule({ selector: ":root", source: root.source });
    // Add base css variables to :root
    for (const [key, value] of Object.entries(variables)) {
        const declaration = new Declaration({prop: `--${key}`, value});
        newRule.append(declaration);
    }
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
 * @param {Object} opts.variables - An object of the form: {base_variable_name_1: value, base_variable_name_2: value, ...}
 * @param {derive} opts.derive - The callback which contains the logic for resolving derived variables
 */
module.exports = (opts = {}) => {
    aliasMap = new Map();
    resolvedMap = new Map();
    return {
        postcssPlugin: "postcss-compile-variables",

        Once(root, {Rule, Declaration}) {
            /*
            Go through the CSS file once to extract all aliases.
            We use the extracted alias when resolving derived variables
            later.
            */
            root.walkDecls(decl => extractAlias(decl));
            root.walkDecls(decl => resolveDerivedVariable(decl, opts));
            addResolvedVariablesToRootSelector(root, opts.variables, {Rule, Declaration});
        },
    };
};

module.exports.postcss = true;
