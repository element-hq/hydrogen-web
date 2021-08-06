/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

const fsRoot = require("fs");
const fs = fsRoot.promises;
const path = require("path");
const { rollup } = require('rollup');
const { fileURLToPath } = require('url');
const { dirname } = require('path');
// needed to translate commonjs modules to esm
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const { nodeResolve } = require('@rollup/plugin-node-resolve');

const projectDir = path.join(__dirname, "../");

async function removeDirIfExists(targetDir) {
    try {
        await fs.rmdir(targetDir, {recursive: true});
    } catch (err) {
        if (err.code !== "ENOENT") {
            throw err;
        }
    }
}

/** function used to resolve common-js require calls below. */
function packageIterator(request, start, defaultIterator) {
    // this is just working for bs58, would need to tune it further for other dependencies
    if (request === "safe-buffer") {
        return [path.join(projectDir, "/scripts/package-overrides/safe-buffer")];
    } else if (request === "buffer/") {
        return [path.join(projectDir, "/scripts/package-overrides/buffer")];
    } else {
        return defaultIterator();
    }
}

async function commonjsToESM(src, dst) {
    // create js bundle
    const bundle = await rollup({
        treeshake: {moduleSideEffects: false},
        input: src,
        plugins: [commonjs(), json(), nodeResolve({
            browser: true,
            preferBuiltins: false,
            customResolveOptions: {packageIterator}
        })]
    });
    const {output} = await bundle.generate({
        format: 'es'
    });
    const code = output[0].code;
    await fs.writeFile(dst, code, "utf8");
}

async function populateLib() {
    const libDir = path.join(projectDir, "lib/");
    await removeDirIfExists(libDir);
    await fs.mkdir(libDir);
    const olmSrcDir = path.dirname(require.resolve("@matrix-org/olm"));
    const olmDstDir = path.join(libDir, "olm/");
    await fs.mkdir(olmDstDir);
    for (const file of ["olm.js", "olm.wasm", "olm_legacy.js"]) {
        await fs.copyFile(path.join(olmSrcDir, file), path.join(olmDstDir, file));
    }
    // transpile node-html-parser to esm
    await fs.mkdir(path.join(libDir, "node-html-parser/"));
    await commonjsToESM(
        require.resolve('node-html-parser/dist/index.js'),
        path.join(libDir, "node-html-parser/index.js")
    );
    // transpile another-json to esm
    await fs.mkdir(path.join(libDir, "another-json/"));
    await commonjsToESM(
        require.resolve('another-json/another-json.js'),
        path.join(libDir, "another-json/index.js")
    );
    // transpile bs58 to esm
    await fs.mkdir(path.join(libDir, "bs58/"));
    await commonjsToESM(
        require.resolve('bs58/index.js'),
        path.join(libDir, "bs58/index.js")
    );
    // transpile base64-arraybuffer to esm
    await fs.mkdir(path.join(libDir, "base64-arraybuffer/"));
    await commonjsToESM(
        require.resolve('base64-arraybuffer/lib/base64-arraybuffer.js'),
        path.join(libDir, "base64-arraybuffer/index.js")
    );
    // this probably should no go in here, we can just import "aes-js" from legacy-extras.js
    // as that file is never loaded from a browser
    
    // transpile aesjs to esm
    await fs.mkdir(path.join(libDir, "aes-js/"));
    await commonjsToESM(
        require.resolve('aes-js/index.js'),
        path.join(libDir, "aes-js/index.js")
    );
    // es6-promise is already written as an es module,
    // but it does need to be babelified, and current we don't babelify
    // anything in node_modules in the build script, so make a bundle that
    // is conveniently not placed in node_modules rather than symlinking.
    await fs.mkdir(path.join(libDir, "es6-promise/"));
    await commonjsToESM(
        require.resolve('es6-promise/lib/es6-promise/promise.js'),
        path.join(libDir, "es6-promise/index.js")
    );
    // fake-indexeddb, used for tests (but unresolvable bare imports also makes the build complain)
    // and might want to use it for in-memory storage too, although we probably do ts->es6 with esm
    // directly rather than ts->es5->es6 as we do now. The bundle is 240K currently.
    await fs.mkdir(path.join(libDir, "fake-indexeddb/"));
    await commonjsToESM(
        path.join(projectDir, "/scripts/package-overrides/fake-indexeddb.js"),
        path.join(libDir, "fake-indexeddb/index.js")
    );
}

populateLib();
