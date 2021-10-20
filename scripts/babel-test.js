babel = require('@babel/standalone');

const code = `
async function doit() {
    const foo = {bar: 5};
    const mapped = Object.values(foo).map(n => n*n);
    console.log(mapped);
    await Promise.resolve();
}
doit();
`;

const {code: babelCode} = babel.transform(code, {
    babelrc: false,
    configFile: false,
    presets: [
        [
            "env",
            {
                useBuiltIns: "entry",
                modules: false,
                corejs: "3.4",
                targets: "IE 11",
                // we provide our own promise polyfill (es6-promise)
                // with support for synchronous flushing of
                // the queue for idb where needed 
                // exclude: ["es.promise", "es.promise.all-settled", "es.promise.finally"]
            }
        ]
    ]
});
console.log(babelCode);
