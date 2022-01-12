#!/usr/bin/env node
const fs = require("fs");
const appManifest = require("../../package.json");
const baseSDKManifest = require("./base-manifest.json");
/*
    need to leave exports out of base-manifest.json because of #vite-bug,
    with the downside that we can't support environments that support
    both esm and commonjs modules, so we pick just esm.
    ```
    "exports": {
        ".": {
            "import": "./hydrogen.es.js",
            "require": "./hydrogen.cjs.js"
        },
        "./paths/vite": "./paths/vite.js",
        "./style.css": "./style.css"
    },
    ```

    Also need to leave typescript type definitions out until the
    typescript conversion is complete and all imports in the d.ts files
    exists.
    ```
    "types": "types/lib.d.ts"
    ```
*/
const mergeOptions = require('merge-options');

const manifestExtension = {
    devDependencies: undefined,
    scripts: undefined,
};

const manifest = mergeOptions(appManifest, baseSDKManifest, manifestExtension);
const json = JSON.stringify(manifest, undefined, 2);
const outFile = process.argv[2];
fs.writeFileSync(outFile, json, {encoding: "utf8"});
