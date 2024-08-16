/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import fs from "fs/promises";
import path from "path";

/**
 * This rollup plugin makes it possible to use the serviceworker with the dev server.
 * The service worker is located in `/src/platform/web/sw.js` and it contains some
 * fields that need to be replaced with sensible values.
 *
 * We have a plugin that does this during build (see `./service-worker.js`).
 * This plugin does more or less the same but for dev.
 */

export function transformServiceWorkerInDevServer() {
    // See https://vitejs.dev/config/shared-options.html#define
    // Comes from vite.config.js
    let define;

    return {
        name: "hydrogen:transformServiceWorkerInDevServer",
        apply: "serve",
        enforce: "pre",

        configResolved(resolvedConfig) {
            // store the resolved config
            define = resolvedConfig.define;
        },

        async load(id) {
            if (!id.includes("sw.js")) return null;
            let code = await readServiceWorkerCode();
            for (const [key, value] of Object.entries(define)) {
                code = code.replaceAll(key, value);
            }
            return code;
        },
    };
}

/**
 * Read service worker code from `src/platform/web/sw.js`
 * @returns code as string
 */
async function readServiceWorkerCode() {
    const resolvedLocation = path.resolve(
        __dirname,
        "../../",
        "./src/platform/web/sw.js"
    );
    const data = await fs.readFile(resolvedLocation, { encoding: "utf-8" });
    return data;
}
