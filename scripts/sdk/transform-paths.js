#!/usr/bin/env node

/**
This script transforms the string literals in the sdk path files to adjust paths
from what they are at development time to what they will be in the sdk package.

It does this by looking in all string literals in the paths file and looking for file names
that we expect and need replacing (as they are bundled with the sdk).
 
Usage: ./transform-paths.js <input file> <output file>
*/

const acorn = require("acorn");
const walk = require("acorn-walk")
const escodegen = require("escodegen");
const fs = require("fs");

const code = fs.readFileSync(process.argv[2], {encoding: "utf8"});
const ast = acorn.parse(code, {ecmaVersion: "13", sourceType: "module"});

function changePrefix(value, file, newPrefix = "") {
    const idx = value.indexOf(file);
    if (idx !== -1) {
        return newPrefix + value.substr(idx);
    }
    return value;
}

walk.simple(ast, {
    Literal(node) {
        node.value = changePrefix(node.value, "download-sandbox.html", "../");
        node.value = changePrefix(node.value, "main.js", "../");
    }
});
const transformedCode = escodegen.generate(ast);
fs.writeFileSync(process.argv[3], transformedCode, {encoding: "utf8"})
