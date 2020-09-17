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

import fsRoot from "fs";
const fs = fsRoot.promises;
import path from "path";
import { rollup } from 'rollup';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// needed to translate commonjs modules to esm
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import {removeDirIfExists} from "./common.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = path.join(__dirname, "../");

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
        input: src,
        plugins: [commonjs(), nodeResolve({
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
    const modulesDir = path.join(projectDir, "node_modules/");
    await removeDirIfExists(libDir);
    await fs.mkdir(libDir);
    const olmSrcDir = path.join(modulesDir, "olm/");
    const olmDstDir = path.join(libDir, "olm/");
    await fs.mkdir(olmDstDir);
    for (const file of ["olm.js", "olm.wasm", "olm_legacy.js"]) {
        await fs.symlink(path.join(olmSrcDir, file), path.join(olmDstDir, file));
    }
    // transpile another-json to esm
    await fs.mkdir(path.join(libDir, "another-json/"));
    await commonjsToESM(
        path.join(modulesDir, 'another-json/another-json.js'),
        path.join(libDir, "another-json/index.js")
    );
    // transpile bs58 to esm
    await fs.mkdir(path.join(libDir, "bs58/"));
    await commonjsToESM(
        path.join(modulesDir, 'bs58/index.js'),
        path.join(libDir, "bs58/index.js")
    );
    // transpile base64-arraybuffer to esm
    await fs.mkdir(path.join(libDir, "base64-arraybuffer/"));
    await commonjsToESM(
        path.join(modulesDir, 'base64-arraybuffer/lib/base64-arraybuffer.js'),
        path.join(libDir, "base64-arraybuffer/index.js")
    );
    // transpile aesjs to esm
    await fs.mkdir(path.join(libDir, "aes-js/"));
    await commonjsToESM(
        path.join(modulesDir, 'aes-js/index.js'),
        path.join(libDir, "aes-js/index.js")
    );
}

populateLib();
