SDK:

 - we need to compile src/lib.ts to javascript, with a d.ts file generated as well. We need to compile to javascript once for cjs and once of es modules. The package.json looks like this:

```
"main": "./dist/index.cjs",
  "exports": {
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs"
  },
  "types": "dist/index.d.ts",
```

we don't need to bundle for the sdk case! we might need to do some transpilation to just plain ES6 (e.g. don't assume ?. and ??) we could use a browserslist query for this e.g. `node 14`. esbuild seems to support this as well, tldraw uses esbuild for their build.

one advantage of not bundling the files for the sdk is that you can still use import overrides in the consuming project build settings. is that an idiomatic way of doing things though?




this way we will support typescript, non-esm javascript and esm javascript using libhydrogen as an SDK

got this from https://medium.com/dazn-tech/publishing-npm-packages-as-native-es-modules-41ffbc0a9dea

how about the assets?

we also need to build the app

we need to be able to version libhydrogen independently from hydrogen the app? as any api breaking changes will need a major version increase. we probably want to end up with a monorepo where the app uses the sdk as well and we just use the local code with yarn link?

## Assets

we want to provide scss/sass files, but also css that can be included
https://github.com/webpack/webpack/issues/7353 seems to imply that we just need to include the assets in the published files and from there on it is the consumer of libhydrogen's problem.


how does all of this tie in with vite?


we want to have hydrogenapp be a consumer of libhydrogen, potentially as two packages in a monorepo ... but we want the SDK to expose views and stylesheets... without having an index.html (which would be in hydrogenapp). this seems a bit odd...?

what would be in hydrogenapp actually? just an index.html file?

I'm not sure it makes sense to have them be 2 different packages in a monorepo, they should really be two artifacts from the same directory.

the stylesheets included in libhydrogen are from the same main.css file as is used in the app

https://www.freecodecamp.org/news/build-a-css-library-with-vitejs/

basically, we import the sass file from src/lib.ts so it is included in the assets there too, and we also create a plugin that emits a file for every sass file as suggested in the link above?

we probably want two different build commands for the app and the sdk though, we could have a parent vite config that both build configs extend from?


### Dependency assets
our dependencies should not be bundled for the SDK case. So if we import aesjs, it would be up to the build system of the consuming project to make that import work.

the paths.ts thingy ... we want to make it easy for people to setup the assets for our dependencies (olm), some assets are also part of the sdk itself. it might make sense to make all of the assets there part of the sdk (e.g. bundle olm.wasm and friends?) although shipping crypto, etc ...

perhaps we should have an include file per build system that treats own assets and dep assets the same by including the package name as wel for our own deps:
```js
import _downloadSandboxPath from "@matrix-org/hydrogen-sdk/download-sandbox.html?url";
import _serviceWorkerPath from "@matrix-org/hydrogen-sdk/sw.js?url"; // not yet sure this is the way to do it
import olmWasmPath from "@matrix-org/olm/olm.wasm?url";
import olmJsPath from "@matrix-org/olm/olm.js?url";
import olmLegacyJsPath from "@matrix-org/olm/olm_legacy.js?url";

export const olmPaths = {
    wasm: olmWasmPath,
    legacyBundle: olmLegacyJsPath,
    wasmBundle: olmJsPath,
};

export const downloadSandboxPath = _downloadSandboxPath;
```

we could put this file per build system, as ESM, in dist as well so you can include it to get the paths


## Tooling

 - `vite` a more high-level build tool that takes your index.html and turns it into optimized assets that you can host for production, as well as a very fast dev server. is used to have good default settings for our tools, typescript support, and also deals with asset compiling. good dev server. Would be nice to have the same tool for dev and prod. vite has good support for using `import` for anything that is not javascript, where we had an issue with `snowpack` (to get the prod path of an asset).
 - `rollup`: inlines 
 - `lerna` is used to handle multi-package monorepos
 - `esbuild`: a js/ts build tool that we could use for building the lower level sdk where no other assets are involved, `vite` uses it for fast dev builds (`rollup` for prod). For now we won't extract a lower level sdk though.


## TODO

 - finish vite app build (without IE11 for now?)
 - create vite config to build src/lib.ts in cjs and esm, inheriting from a common base config with the app config
    - this will create a dist folder with
        - the whole source tree in es and cjs format
        - an es file to import get the asset paths as they are expected by Platform, per build system
        - assets from hydrogen itself:
            - css files and any resource used therein
            - download-sandbox.html
        - a type declaration file (index.d.ts)

## Questions
 - can rollup not bundle the source tree and leave modules intact?
    - if we can use a function that creates a chunk per file to pass to manualChunks and disable chunk hashing we can probably do this. See https://rollupjs.org/guide/en/#outputmanualchunks

    looks like we should be able to disable chunk name hashing with chunkFileNames https://rollupjs.org/guide/en/#outputoptions-object


    we should test this with a vite test config
 
    we also need to compile down to ES6, both for the app and for the sdk
