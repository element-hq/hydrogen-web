if [ -z "$1" ]; then
    echo "provide a new version, current version is $(jq '.version' package.json)"
    exit 1
fi
VERSION=$1
git checkout master
git pull --rebase origin master
jq ".version = \"$VERSION\"" package.json > package.json.tmp
rm package.json
mv package.json.tmp package.json
git add package.json
git commit -m "release v$VERSION"
git tag "v$VERSION"
git push --tags origin master
