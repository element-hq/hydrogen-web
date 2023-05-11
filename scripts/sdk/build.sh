#!/bin/bash
# Exit whenever one of the commands fail with a non-zero exit code
set -e
set -o pipefail
# Enable extended globs so we can use the `!(filename)` glob syntax
shopt -s extglob

# Only remove the directory contents instead of the whole directory to maintain
# the `npm link`/`yarn link` symlink
rm -rf target/*
yarn run vite build -c vite.sdk-assets-config.js
yarn run vite build -c vite.sdk-lib-config.js
yarn tsc -p tsconfig-declaration.json
./scripts/sdk/create-manifest.js ./target/package.json
mkdir target/paths
# this doesn't work, the ?url imports need to be in the consuming project, so disable for now
# ./scripts/sdk/transform-paths.js ./src/platform/web/sdk/paths/vite.js ./target/paths/vite.js
cp doc/SDK.md target/README.md
cp doc/SDK-CHANGELOG.md target/CHANGELOG.md
pushd target/asset-build
rm index.html
popd
pushd target/asset-build/assets
# Remove all `*.wasm` and `*.js` files except for `main.js`
rm !(main).js *.wasm
popd
