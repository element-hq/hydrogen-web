const path = require("path");
const {build} = require("vite");
const {babel} = require('@rollup/plugin-babel');
const {createFilter} = require("@rollup/pluginutils");

const VIRTUAL_ENTRY = "hydrogen:legacy-entry";
const NODE_MODULES_NEEDING_TRANSPILATION = ["es6-promise"];

module.exports = function legacyBuild(entryModuleId, entryImportReplacements, chunkName, extraImports) {
    let parentRoot;
    let code;
    let legacyBundleRef;
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
            code = prependExtraImports(code, extraImports);
            const bundleCode = await buildLegacyChunk(parentRoot, chunkName, code);
            legacyBundleRef = this.emitFile({
                type: "asset",
                source: bundleCode,
                name: `${chunkName}.js`
            });
        },
        generateBundle() {
            if (!legacyBundleRef) {
                throw new Error("no bundle");
            }
            legacyBundleFileName = this.getFileName(legacyBundleRef);
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

/** we replace the imports ourselves instead of relying on rollup-alias or similar, because
 * we only want to replace imports in the entry module, not anywhere in the import tree.
 * This allows to create sub classes for the legacy build that can still import
 * the non-legacy class as a base class, like LegacyPlatform does with Platform.*/
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

function prependExtraImports(code, extraImports) {
    return extraImports.map(i => `import ${JSON.stringify(i)};`).join("\n") + code;
}

async function buildLegacyChunk(root, chunkName, code) {
    const projectRootDir = path.resolve(path.join(root, "../../.."));
    const nodeModulesDir = path.join(projectRootDir, "node_modules");
    const defaultFilter = createFilter([], [], {resolve: projectRootDir});
    const transpiledModuleDirs = NODE_MODULES_NEEDING_TRANSPILATION.map(m => {
        return path.join(nodeModulesDir, m);
    });

    const filterModule = id => {
        if (!defaultFilter(id)) {
            return false;
        }
        if (transpiledModuleDirs.some(d => id.startsWith(d))) {
            return true;
        }
        if (id.startsWith(nodeModulesDir)) {
            return false;
        }
        return true;
    };
    // compile down to whatever IE 11 needs
    const babelPlugin = babel({
        babelrc: false,
        filter: filterModule,
        extensions: [".js", ".ts"],
        babelHelpers: 'bundled',
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
    const resolveEntryPlugin = {
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
        },
    };
    const bundle = await build({
        root,
        configFile: false,
        logLevel: 'error',
        build: {
            write: false,
            minify: false,
            target: "esnext",
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
            resolveEntryPlugin,
            babelPlugin
        ]
    });
    const assets = Array.isArray(bundle.output) ? bundle.output : [bundle.output];
    const mainChunk = assets.find(a => a.name === chunkName);
    return mainChunk.code;
}
