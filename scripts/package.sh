#!/bin/bash
VERSION=$(jq -r ".version" package.json)
PACKAGE=hydrogen-web-$VERSION.tar.gz
yarn build
pushd target
# move config file so we don't override it
# when deploying a new version
mv config.json config.sample.json
tar -czvf ../$PACKAGE ./
popd
echo $PACKAGE
