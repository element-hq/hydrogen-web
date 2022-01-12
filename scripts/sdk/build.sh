#!/bin/bash
rm -rf target
yarn run vite build -c vite.sdk-assets-config.js
yarn run vite build -c vite.sdk-lib-config.js
yarn tsc -p tsconfig-declaration.json
./scripts/sdk/create-manifest.js ./target/package.json
mkdir target/paths
# this doesn't work, the ?url imports need to be in the consuming project, so disable for now
# ./scripts/sdk/transform-paths.js ./src/platform/web/sdk/paths/vite.js ./target/paths/vite.js
cp doc/SDK.md target/README.md
pushd target
pushd asset-build/assets
mv main.*.js ../../main.js
mv index.*.css ../../style.css
mv download-sandbox.*.html ../../download-sandbox.html
rm *.js *.wasm
mv ./* ../../
popd
rm -rf asset-build
mv lib-build/* .
rm -rf lib-build
popd
