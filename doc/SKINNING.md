# Skinning

Any source file can be replaced at build time by mapping the path in a JSON file passed in to the build command, e.g. `yarn build --override-imports customizations.json`. The file should be written like so:

```json
{
    "src/platform/web/ui/session/room/timeline/TextMessageView.js": "src/platform/web/ui/session/room/timeline/MyTextMessageView.js"
}
```
The paths are relative to the location of the mapping file, but the mapping file should be in a parent directory of the files you want to replace.

You should see a "replacing x with y" line (twice actually, for the normal and legacy build).
