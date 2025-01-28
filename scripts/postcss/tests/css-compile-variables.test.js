/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const offColor = require("off-color").offColor;
const postcss = require("postcss");
const plugin = require("../css-compile-variables");
const derive = require("../color").derive;
const run = require("./common").createTestRunner(plugin);

module.exports.tests = function tests() {
    return {
        "derived variables are resolved": async (assert) => {
            const inputCSS = `
            :root {
                --foo-color: #ff0;
            }
            div {
                background-color: var(--foo-color--lighter-50);
            }`;
            const transformedColor = offColor("#ff0").lighten(0.5);
            const outputCSS =
                inputCSS +
                `
            :root {
                --foo-color--lighter-50: ${transformedColor.hex()};
            }
            `;
            await run( inputCSS, outputCSS, {derive}, assert);
        },

        "derived variables work with alias": async (assert) => {
            const inputCSS = `
            :root {
                --icon-color: #fff;
            }
            div {
                background: var(--icon-color--darker-20);
                --my-alias: var(--icon-color--darker-20);
                color: var(--my-alias--lighter-15);
            }`;
            const colorDarker = offColor("#fff").darken(0.2).hex();
            const aliasLighter = offColor(colorDarker).lighten(0.15).hex();
            const outputCSS = inputCSS + `:root {
                --icon-color--darker-20: ${colorDarker};
                --my-alias--lighter-15: ${aliasLighter};
            }
            `;
            await run(inputCSS, outputCSS, {derive}, assert);
        },

        "derived variable throws if base not present in config": async (assert) => {
            const css = `:root {
                color: var(--icon-color--darker-20);
            }`;
            assert.rejects(async () => await postcss([plugin({ variables: {} })]).process(css, { from: undefined, }));
        },

        "multiple derived variable in single declaration is parsed correctly": async (assert) => {
            const inputCSS = `
            :root {
                --foo-color: #ff0;
            }
            div {
                background-color: linear-gradient(var(--foo-color--lighter-50), var(--foo-color--darker-20));
            }`;
            const transformedColor1 = offColor("#ff0").lighten(0.5);
            const transformedColor2 = offColor("#ff0").darken(0.2);
            const outputCSS =
                inputCSS +
                `
            :root {
                --foo-color--lighter-50: ${transformedColor1.hex()};
                --foo-color--darker-20: ${transformedColor2.hex()};
            }
            `;
            await run( inputCSS, outputCSS, {derive}, assert);
        },

        "multiple aliased-derived variable in single declaration is parsed correctly": async (assert) => {
            const inputCSS = `
            :root {
                --foo-color: #ff0;
            }
            div {
                --my-alias: var(--foo-color);
                background-color: linear-gradient(var(--my-alias--lighter-50), var(--my-alias--darker-20));
            }`;
            const transformedColor1 = offColor("#ff0").lighten(0.5);
            const transformedColor2 = offColor("#ff0").darken(0.2);
            const outputCSS =
                inputCSS +
                `
            :root {
                --my-alias--lighter-50: ${transformedColor1.hex()};
                --my-alias--darker-20: ${transformedColor2.hex()};
            }
            `;
            await run( inputCSS, outputCSS, {derive}, assert);
        },

        "compiledVariables map is populated": async (assert) => {
            const compiledVariables = new Map();
            const inputCSS = `
            :root {
                --icon-color: #fff;
            }
            div {
                background: var(--icon-color--darker-20);
                --my-alias: var(--icon-color--darker-20);
                color: var(--my-alias--lighter-15);
            }`;
            await postcss([plugin({ derive, compiledVariables })]).process(inputCSS, { from: "/foo/bar/test.css", });
            const actualArray = compiledVariables.get("/foo/bar")["derived-variables"];
            const expectedArray = ["icon-color--darker-20", "my-alias=icon-color--darker-20", "my-alias--lighter-15"];
            assert.deepStrictEqual(actualArray.sort(), expectedArray.sort());
        },

        "derived variable are supported in urls": async (assert) => {
            const inputCSS = `
            :root {
                --foo-color: #ff0;
            }
            div {
                background-color: var(--foo-color--lighter-50);
                background: url("./foo/bar/icon.svg?primary=foo-color--darker-5");
            }
            a {
                background: url("foo/bar/icon.svg");
            }`;
            const transformedColorLighter = offColor("#ff0").lighten(0.5);
            const transformedColorDarker = offColor("#ff0").darken(0.05);
            const outputCSS =
                inputCSS +
                `
            :root {
                --foo-color--lighter-50: ${transformedColorLighter.hex()};
                --foo-color--darker-5: ${transformedColorDarker.hex()};
            }
            `;
            await run( inputCSS, outputCSS, {derive}, assert);
        }
    };
};
