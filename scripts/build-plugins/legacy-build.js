const { build } = require("vite");
const path = require("path");
let babel; // big import, only do so when used below
const VIRTUAL_ENTRY = "hydrogen:legacy-entry";

module.exports = function legacyBuild(entryModuleId, entryImportReplacements, chunkName, extraImports) {
    let parentRoot;
    let code;
    let legacyBundleFileName;
    return {
        name: "hydrogen:legacyBuild",
        apply: "build",
        configResolved: config => {
            parentRoot = config.root;
        },
        async moduleParsed(info) {
            if (info.id === entryModuleId) {
                code = info.code;
            }
        },
        async buildEnd() {
            if (!code) {
                throw new Error("couldnt find entry");
            }
            for (const [importSource, newImportSource] of Object.entries(entryImportReplacements)) {
                code = replaceImport(this, code, importSource, newImportSource);
            }
            code = addExtraImports(code, extraImports);
            const mainChunk = await buildLegacyChunk(parentRoot, chunkName, code);
            this.emitFile({
                type: "asset",
                source: mainChunk.code,
                fileName: mainChunk.fileName,
                name: mainChunk.name
            });
            legacyBundleFileName = mainChunk.fileName;
        },
        transformIndexHtml: {
            transform(html) {
                if (!legacyBundleFileName) {
                    throw new Error("no bundle");
                }
                return [{
                    tag: "script",
                    attrs: {type: "text/javascript", nomodule: true, src: legacyBundleFileName},
                    injectTo: "head"
                }];
            },
        },
    }
}


function replaceImport(pluginCtx, code, importSource, newImportSource) {
    const ast = pluginCtx.parse(code);
    for (const node of ast.body) {
        if (node.type === "ImportDeclaration") {
            const sourceNode = node.source;
            if (sourceNode.value === importSource) {
                code = code.substr(0, sourceNode.start) + JSON.stringify(newImportSource) + code.substr(sourceNode.end);
                return code;
            }
        }
    }
    throw new Error(`Could not find import ${JSON.stringify(importSource)} to replace`);
}

function addExtraImports(code, extraImports) {
    return extraImports.map(i => `import ${JSON.stringify(i)};`).join("\n") + code;
}

async function buildLegacyChunk(root, chunkName, code) {
    if (!babel) {
        babel = require('@rollup/plugin-babel');
    }
    // compile down to whatever IE 11 needs
    const babelPlugin = babel.babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**',
        presets: [
            [
                "@babel/preset-env",
                {
                    useBuiltIns: "entry",
                    corejs: "3.4",
                    targets: "IE 11",
                    // we provide our own promise polyfill (es6-promise)
                    // with support for synchronous flushing of
                    // the queue for idb where needed 
                    exclude: ["es.promise", "es.promise.all-settled", "es.promise.finally"]
                }
            ]
        ]
    });
    const bundle = await build({
        root,
        configFile: false,
        logLevel: 'error',
        build: {
            write: false,
            target: false,
            minify: true,
            assetsInlineLimit: 0,
            polyfillModulePreload: false,
            rollupOptions: {
                input: {
                    [chunkName]: VIRTUAL_ENTRY
                },
                output: {
                    format: "iife",
                    manualChunks: undefined
                }
            },
        },
        plugins: [
            {
                name: "hydrogen:resolve-legacy-entry",
                resolveId(id, importer) {
                    if (id === VIRTUAL_ENTRY) {
                        return id;
                    } else if (importer === VIRTUAL_ENTRY && id.startsWith("./")) {
                        return this.resolve(path.join(root, id));
                    }
                },
                load(id) {
                    if (id === VIRTUAL_ENTRY) {
                        return code;
                    }
                }
            },
            babelPlugin
        ]
    });
    const assets = Array.isArray(bundle.output) ? bundle.output : [bundle.output];
    const mainChunk = assets.find(a => a.name === chunkName);
    return mainChunk;
}
