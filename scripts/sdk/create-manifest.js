#!/usr/bin/env node
const fs = require("fs");
const baseManifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
const mergeOptions = require('merge-options');

const manifestExtension = {
    name: "hydrogen-sdk",
    main: "./hydrogen.cjs.js",
    exports: {
        import: "./hydrogen.es.js",
        require: "./hydrogen.cjs.js"
    },
    files: [],
    types: "types/lib.d.ts",
    devDependencies: undefined,
    scripts: undefined,
};
const manifest = mergeOptions(baseManifest, manifestExtension);
const json = JSON.stringify(manifest, undefined, 2);
const outFile = process.argv[2];
fs.writeFileSync(outFile, json, {encoding: "utf8"});
