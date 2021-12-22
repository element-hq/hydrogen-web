#!/usr/bin/env node
const fs = require("fs");
const appManifest = require("../../package.json")
const baseSDKManifest = require("./base-manifest.json")
const mergeOptions = require('merge-options');

const manifestExtension = {
    devDependencies: undefined,
    scripts: undefined,
};

const manifest = mergeOptions(appManifest, baseSDKManifest, manifestExtension);
const json = JSON.stringify(manifest, undefined, 2);
const outFile = process.argv[2];
fs.writeFileSync(outFile, json, {encoding: "utf8"});
