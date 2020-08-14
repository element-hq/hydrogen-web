git checkout gh-pages
cp -R target/* .
git add $(find . -maxdepth 1 -type f)
git add themes
git commit -m "update hydrogen"
git checkout master
