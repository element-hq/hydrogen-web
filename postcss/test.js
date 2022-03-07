const offColor = require("off-color").offColor;
const postcss = require("postcss");
const plugin = require("./css-compile-variables");

async function run(input, output, opts = {}, assert) {
    let result = await postcss([plugin(opts)]).process(input, { from: undefined, });
    assert.strictEqual(
        result.css.replaceAll(/\s/g, ""),
        output.replaceAll(/\s/g, "")
    );
    assert.strictEqual(result.warnings().length, 0);
}

module.exports.tests = function tests() {
    return {
        "derived variables are resolved": async (assert) => {
            const inputCSS = `div {
                background-color: var(--foo-color--lighter-50);
            }`;
            const transformedColor = offColor("#ff0").lighten(0.5);
            const outputCSS =
                inputCSS +
                `
            :root {
                --foo-color: #ff0;
                --foo-color--lighter-50: ${transformedColor.hex()};
            }
            `;
            await run(
                inputCSS,
                outputCSS,
                { variables: { "foo-color": "#ff0" } },
                assert
            );
        },

        "derived variables work with alias": async (assert) => {
            const inputCSS = `div {
                background: var(--icon-color--darker-20);
                --my-alias: var(--icon-color--darker-20);
                color: var(--my-alias--lighter-15);
            }`;
            const colorDarker = offColor("#fff").darken(0.2).hex();
            const aliasLighter = offColor(colorDarker).lighten(0.15).hex();
            const outputCSS = `div {
                background: var(--icon-color--darker-20);
                --my-alias: var(--icon-color--darker-20);
                color: var(--my-alias--lighter-15);
            }
            :root {
                --icon-color: #fff;
                --icon-color--darker-20: ${colorDarker};
                --my-alias--lighter-15: ${aliasLighter};
            }
            `;
            await run(inputCSS, outputCSS, { variables: { "icon-color": "#fff" }, }, assert);
        },

        "derived variable throws if base not present in config": async (assert) => {
            const css = `:root {
                color: var(--icon-color--darker-20);
            }`;
            assert.rejects(async () => await postcss([plugin({ variables: {} })]).process(css, { from: undefined, }));
        }
    };
};
