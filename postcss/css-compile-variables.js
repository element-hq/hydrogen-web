import { Color } from "color";

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
    const [,wholeVariable, baseVariable, operation, argument] = matches;
    if (!variables[baseVariable]) {
      // hmm.. baseVariable should be in config..., maybe this is an alias?
      if (!aliasMap.get(`--${baseVariable}`)) {
        throw new Error(`Cannot derive from ${baseVariable} because it is neither defined in config nor is it an alias!`);
      }
    }
    switch (operation) {
      case "darker": {
        const colorString = variables[baseVariable] ?? getValueFromAlias(baseVariable);
        const newColorString = new Color(colorString).darken(argument / 100).hex();
        resolvedMap.set(wholeVariable, newColorString);
        break;
      }
      case "lighter": {
        const colorString = variables[baseVariable] ?? getValueFromAlias(baseVariable);
        const newColorString = new Color(colorString).lighten(argument / 100).hex();
        resolvedMap.set(wholeVariable, newColorString);
        break;
      }
    }
  }
}

function extractAlias(decl) {
    const RE_VARIABLE_PROP = /--(.+)/;
    const wholeVariable = decl.value.match(RE_VARIABLE_VALUE)?.[1];
    if (RE_VARIABLE_PROP.test(decl.prop) && wholeVariable) {
        aliasMap.set(decl.prop, wholeVariable);
    }
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

    Once(root) {
      /*
      Go through the CSS file once to extract all aliases.
      We use the extracted alias when resolving derived variables
      later.
      */
      root.walkDecls(decl => extractAlias(decl));
    },

    Declaration(declaration) {
      resolveDerivedVariable(declaration, variables);
    },

    OnceExit(root, { Rule, Declaration }) {
      const newRule = new Rule({ selector: ":root", source: root.source })
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
    },
  };
};

module.exports.postcss = true;
