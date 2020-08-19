VERSION=$(jq -r ".version" package.json)
PACKAGE=hydrogen-web-$VERSION.tar.gz
yarn build
pushd target
tar -czvf ../$PACKAGE ./
popd
echo $PACKAGE
