const valueParser = require("postcss-value-parser");
let counter = 0;
const variableMap = new Map();
const format = "icon-url"

function extractUrl(decl) {
    const value = decl.value;
    const parsed = valueParser(value);
    const variables = [];
    parsed.walk(node => {
        if (node.type !== "function" || node.value !== "url") {
            return;
        }
        const urlStringNode = node.nodes[0];
        const variableName = `--${format}-${counter++}`;
        variableMap.set(variableName, `"${urlStringNode.value}"`);
        const varNode = {
            type: "function",
            value: "var",
            nodes: [{ type: "word", value: variableName }],
        };
        //replace the url-string node with this var-node
        node.nodes[0] = varNode;
    });
    decl.assign({prop: decl.prop, value: parsed.toString()})
    return variables;
}

function addResolvedVariablesToRootSelector(root, { Rule, Declaration }) {
    const newRule = new Rule({ selector: ":root", source: root.source });
    // Add derived css variables to :root
    variableMap.forEach((value, key) => {
        const declaration = new Declaration({ prop: key, value });
        newRule.append(declaration);
    });
    root.append(newRule);
}

/* *
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts = {}) => {
    return {
        postcssPlugin: "postcss-url-to-variable",

        Once(root, { Rule, Declaration }) {
            root.walkDecls(decl => extractUrl(decl));
            addResolvedVariablesToRootSelector(root, { Rule, Declaration });
        },
    };
};

module.exports.postcss = true;

