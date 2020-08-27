/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
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
// multi-entry plugin so we can add polyfill file to main

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = path.join(__dirname, "../");

async function commonjsToESM(src, dst) {
    // create js bundle
    const bundle = await rollup({
        input: src,
        plugins: [commonjs()]
    });
    const {output} = await bundle.generate({
        format: 'es'
    });
    const code = output[0].code;
    await fs.writeFile(dst, code, "utf8");
}

async function transpile() {
    await fs.mkdir(path.join(projectDir, "lib/another-json/"));
    await commonjsToESM(
        path.join(projectDir, 'node_modules/another-json/another-json.js'),
        path.join(projectDir, "lib/another-json/index.js")
    );
}

transpile();
