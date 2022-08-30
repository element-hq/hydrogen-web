#!/bin/sh
cp scripts/test-derived-theme/theme.json target/assets/theme-customer.json
cat target/config.json | jq '.themeManifests += ["assets/theme-customer.json"]' | cat > target/config.temp.json
rm target/config.json
mv target/config.temp.json target/config.json
