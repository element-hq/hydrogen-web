import fsRoot from "fs";
const fs = fsRoot.promises;
import { rollup } from 'rollup';
// needed for legacy bundle
import babel from '@rollup/plugin-babel';
// needed to find the polyfill modules in the main-legacy.js bundle
import { nodeResolve } from '@rollup/plugin-node-resolve';
// needed because some of the polyfills are written as commonjs modules
import commonjs from '@rollup/plugin-commonjs';
// multi-entry plugin so we can add polyfill file to main
import multi from '@rollup/plugin-multi-entry';
import removeJsComments from 'rollup-plugin-cleanup';
// replace urls of asset names with content hashed version

async function build(inputFile, outputFile) {
    // compile down to whatever IE 11 needs
    const babelPlugin = babel.babel({
        babelHelpers: 'bundled',
        exclude: '../../node_modules/**',
        presets: [
            [
                "@babel/preset-env",
                {
                    useBuiltIns: "entry",
                    corejs: "3",
                    targets: "IE 11"
                }
            ]
        ]
    });
    const polyfillFile = '../../src/worker-polyfill.js';
    // create js bundle
    const rollupConfig = {
        input: [polyfillFile, inputFile],
        plugins: [multi(), commonjs(), nodeResolve(), babelPlugin, removeJsComments({comments: "none"})]
    };
    const bundle = await rollup(rollupConfig);
    const {output} = await bundle.generate({
        format: 'iife',
        name: `bundle`
    });
    const code = output[0].code;
    await fs.writeFile(outputFile, code, "utf8");
}

build(process.argv[2], process.argv[3]);
