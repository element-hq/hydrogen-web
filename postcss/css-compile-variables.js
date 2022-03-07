const offColor = require("off-color").offColor;

let aliasMap;
let resolvedMap;
const RE_VARIABLE_VALUE = /var\((--(.+)--(.+)-(.+))\)/;

function getValueFromAlias(alias) {
    const derivedVariable = aliasMap.get(`--${alias}`);
    return resolvedMap.get(derivedVariable); // what if we haven't resolved this variable yet?
}

function resolveDerivedVariable(decl, variables) {
    const matches = decl.value.match(RE_VARIABLE_VALUE);
    if (matches) {
        const [, wholeVariable, baseVariable, operation, argument] = matches;
        if (!variables[baseVariable]) {
            // hmm.. baseVariable should be in config..., maybe this is an alias?
            if (!aliasMap.get(`--${baseVariable}`)) {
                throw new Error(`Cannot derive from ${baseVariable} because it is neither defined in config nor is it an alias!`);
            }
        }
        switch (operation) {
            case "darker": {
                const colorString = variables[baseVariable] ?? getValueFromAlias(baseVariable);
                const newColorString = offColor(colorString).darken(argument / 100).hex();
                resolvedMap.set(wholeVariable, newColorString);
                break;
            }
            case "lighter": {
                const colorString = variables[baseVariable] ?? getValueFromAlias(baseVariable);
                const newColorString = offColor(colorString).lighten(argument / 100).hex();
                resolvedMap.set(wholeVariable, newColorString);
                break;
            }
        }
    }
}

function extractAlias(decl) {
    const wholeVariable = decl.value.match(RE_VARIABLE_VALUE)?.[1];
    if (decl.prop.startsWith("--") && wholeVariable) {
        aliasMap.set(decl.prop, wholeVariable);
    }
}

function addResolvedVariablesToRootSelector(root, variables, { Rule, Declaration }) {
    const newRule = new Rule({ selector: ":root", source: root.source });
    // Add base css variables to :root
    for (const [key, value] of Object.entries(variables)) {
        const declaration = new Declaration({ prop: `--${key}`, value });
        newRule.append(declaration);
    }
    // Add derived css variables to :root
    resolvedMap.forEach((value, key) => {
        const declaration = new Declaration({ prop: key, value });
        newRule.append(declaration);
    });
    root.append(newRule);
}

/* *
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts = {}) => {
    aliasMap = new Map();
    resolvedMap = new Map();
    const { variables } = opts;
    return {
        postcssPlugin: "postcss-compile-variables",

        Once(root, { Rule, Declaration }) {
            /*
            Go through the CSS file once to extract all aliases.
            We use the extracted alias when resolving derived variables
            later.
            */
            root.walkDecls(decl => extractAlias(decl));
            root.walkDecls(decl => resolveDerivedVariable(decl, variables));
            addResolvedVariablesToRootSelector(root, variables, { Rule, Declaration });
        },
    };
};

module.exports.postcss = true;
