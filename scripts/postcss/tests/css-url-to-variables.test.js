/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const plugin = require("../css-url-to-variables");
const run = require("./common").createTestRunner(plugin);
const postcss = require("postcss");

module.exports.tests = function tests() {
    return {
        "url is replaced with variable": async (assert) => {
            const inputCSS = `div {
                background: no-repeat center/80% url("../img/image.svg?primary=main-color--darker-20");
            }
            button {
                background: url("/home/foo/bar/cool.svg?primary=blue&secondary=green");
            }`;
            const outputCSS =
            `div {
                background: no-repeat center/80% var(--icon-url-0);
            }
            button {
                background: var(--icon-url-1);
            }`+
                `
            :root {
                --icon-url-0: url("../img/image.svg?primary=main-color--darker-20");
                --icon-url-1: url("/home/foo/bar/cool.svg?primary=blue&secondary=green");
            }
            `;
            await run(inputCSS, outputCSS, { }, assert);
        },
        "non svg urls without query params are not replaced": async (assert) => {
            const inputCSS = `div {
                background: no-repeat url("./img/foo/bar/image.png");
            }`;
            await run(inputCSS, inputCSS, {}, assert);
        },
        "map is populated with icons": async (assert) => {
            const compiledVariables = new Map();
            compiledVariables.set("/foo/bar", { "derived-variables": ["background-color--darker-20", "accent-color--lighter-15"] });
            const inputCSS = `div {
                background: no-repeat center/80% url("../img/image.svg?primary=main-color--darker-20");
            }
            button {
                background: url("/home/foo/bar/cool.svg?primary=blue&secondary=green");
            }`;
            const expectedObject = {
                "icon-url-0": "../img/image.svg?primary=main-color--darker-20",
                "icon-url-1": "/home/foo/bar/cool.svg?primary=blue&secondary=green",
            };
            await postcss([plugin({compiledVariables})]).process(inputCSS, { from: "/foo/bar/test.css", });
            const sharedVariable = compiledVariables.get("/foo/bar");
            assert.deepEqual(["background-color--darker-20", "accent-color--lighter-15"], sharedVariable["derived-variables"]);
            assert.deepEqual(expectedObject, sharedVariable["icon"]);
        }
    };
};

