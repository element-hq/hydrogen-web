yarn run vite build -c vite.sdk-assets-config.js
yarn run vite build -c vite.sdk-lib-config.js
yarn tsc -p tsconfig-declaration.json
./scripts/sdk/create-manifest.js ./target/package.json
