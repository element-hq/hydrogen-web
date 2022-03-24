/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

const plugin = require("../css-url-to-variables");
const run = require("./common").createTestRunner(plugin);

module.exports.tests = function tests() {
    return {
        "url is replaced with variable": async (assert) => {
            const inputCSS = `div {
                background: no-repeat center/80% url("../img/image.png");
            }
            button {
                background: url("/home/foo/bar/cool.jpg");
            }`;
            const outputCSS =
            `div {
                background: no-repeat center/80% url(var(--icon-url-0));
            }
            button {
                background: url(var(--icon-url-1));
            }`+
                `
            :root {
                --icon-url-0: "../img/image.png";
                --icon-url-1: "/home/foo/bar/cool.jpg";
            }
            `;
            await run( inputCSS, outputCSS, { }, assert);
        },
    };
};

