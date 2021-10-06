const fs = require('fs/promises');
const path = require('path');

module.exports = function injectWebManifest(manifestFile) {
    let root;
    let manifestHref;
    return {
        name: "injectWebManifest",
        apply: "build",
        configResolved: config => {
            root = config.root;
        },
        transformIndexHtml: {
            transform(html) {
                return [{
                    tag: "link",
                    attrs: {rel: "manifest", href: manifestHref},
                    injectTo: "head"
                }];
            },
        },
        generateBundle: async function() {
            const absoluteManifestFile = path.resolve(root, manifestFile);
            const manifestDir = path.dirname(absoluteManifestFile);
            const json = await fs.readFile(absoluteManifestFile, {encoding: "utf8"});
            const manifest = JSON.parse(json);
            for (const icon of manifest.icons) {
                const iconFileName = path.resolve(manifestDir, icon.src);
                const imgData = await fs.readFile(iconFileName);
                const ref = this.emitFile({
                    type: "asset",
                    name: path.basename(iconFileName),
                    source: imgData
                });
                icon.src = this.getFileName(ref);
            }
            const outputName = path.basename(absoluteManifestFile);
            const manifestRef = this.emitFile({
                type: "asset",
                name: outputName,
                source: JSON.stringify(manifest)
            });
            manifestHref = this.getFileName(manifestRef);
        }
    };
}
