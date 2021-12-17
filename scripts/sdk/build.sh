yarn run vite build -c vite.sdk-config.js
yarn tsc -p tsconfig-declaration.json
./scripts/sdk/create-manifest.js ./target/package.json
