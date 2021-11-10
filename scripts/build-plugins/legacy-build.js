const path = require("path");
const {build} = require("vite");
const {babel, getBabelOutputPlugin} = require('@rollup/plugin-babel');
const {createFilter} = require("@rollup/pluginutils");
const { rollup } = require('rollup');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');

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
        if (id.endsWith("?url") || id.endsWith("?raw")) {
            // TODO is this needed
            return true;
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
    const babelPlugin = getBabelOutputPlugin({
        babelrc: false,
        compact: false,
        extensions: [".js", ".ts"],
        // babelHelpers: 'bundled',
        presets: [
            [
                "@babel/preset-env",
                {
                    modules: false,
                    useBuiltIns: "usage",
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
            minify: false,
            target: "esnext",
            assetsInlineLimit: 0,
            polyfillModulePreload: false,
            rollupOptions: {
                external: id => !filterModule(id),
                input: {
                    [chunkName]: VIRTUAL_ENTRY
                },
                output: {
                    format: "esm",
                    manualChunks: undefined
                },
                makeAbsoluteExternalsRelative: false,
            },
        },
        plugins: [
            memoryBabelInputPlugin(VIRTUAL_ENTRY, root, code),
            babelPlugin
        ]
    });
    const assets = Array.isArray(bundle.output) ? bundle.output : [bundle.output];
    const mainChunk = assets.find(a => a.name === chunkName);
    const babelCode = mainChunk.code;
    const bundle2 = await rollup({
        plugins: [
            memoryBabelInputPlugin(VIRTUAL_ENTRY, root, babelCode),
            overridesAsRollupPlugin(new Map(
                [["safe-buffer", "./scripts/package-overrides/safe-buffer/index.js"],
                ["buffer", "./scripts/package-overrides/buffer/index.js"]]), projectRootDir),
            commonjs(),
            nodeResolve(),
        ],
        input: {
            [chunkName]: VIRTUAL_ENTRY
        }
    });
    const {output} = await bundle2.generate({
        format: 'iife',
        name: `hydrogen`
    });
    const bundledCode = output[0].code;
    return bundledCode;
}

function memoryBabelInputPlugin(entryName, dir, code) {
    return {
        name: "hydrogen:resolve-legacy-entry",
        resolveId(id, importer) {
            if (id === entryName) {
                return id;
            } else if (importer === entryName && id.startsWith("./")) {
                return this.resolve(path.join(dir, id));
            }
        },
        load(id) {
            if (id === entryName) {
                return code;
            }
        },
    }
}

function overridesAsRollupPlugin(mapping, basedir) {
    return {
        name: "rewrite-imports",
        async resolveId (source, importer) {
            const target = mapping.get(source);
            if (target) {
                const resolvedTarget = await this.resolve(path.join(basedir, target));
                console.log("resolving", source, resolvedTarget);
                return resolvedTarget;
            }
        }
    };
}
