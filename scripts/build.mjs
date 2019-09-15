import cheerio from "cheerio";
import fsRoot from "fs";
const fs = fsRoot.promises;
import path from "path";
import rollup from 'rollup';
import postcss from "postcss";
import postcssImport from "postcss-import";
import { fileURLToPath } from 'url';
import { dirname } from 'path';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = path.join(__dirname, "../");
const targetDir = path.join(projectDir, "target");

const debug = true;

async function build() {
    // get version number
    const version = JSON.parse(await fs.readFile(path.join(projectDir, "package.json"), "utf8")).version;
    // clear target dir
    await removeDirIfExists(targetDir);
    await fs.mkdir(targetDir);
    
    await buildHtml();
    await buildJs();
    await buildCss();
    await buildOffline(version);

    console.log(`built brawl ${version} successfully`);
}

async function buildHtml() {
    // transform html file
    const devHtml = await fs.readFile(path.join(projectDir, "index.html"), "utf8");
    const doc = cheerio.load(devHtml);
    doc("link[rel=stylesheet]").attr("href", "brawl.css");
    doc("script#main").replaceWith(
        `<script type="text/javascript" src="brawl.js"></script>` +
        `<script type="text/javascript">main(document.body);</script>`);
    removeOrEnableScript(doc("script#phone-debug-pre"), debug);
    removeOrEnableScript(doc("script#phone-debug-post"), debug);
    removeOrEnableScript(doc("script#service-worker"), false);
    doc("html").attr("manifest", "manifest.appcache");
    doc("head").append(`<link rel="manifest" href="manifest.json">`);
    await fs.writeFile(path.join(targetDir, "index.html"), doc.html(), "utf8");
}

async function buildJs() {
    // create js bundle
    const rollupConfig = {
        input: 'src/main.js',
        output: {
            file: path.join(targetDir, "brawl.js"),
            format: 'iife',
            name: 'main'
        }
    };
    const bundle = await rollup.rollup(rollupConfig);
    await bundle.write(rollupConfig);
}

async function buildOffline(version) {
    // write offline availability
    const offlineFiles = ["brawl.js", "brawl.css", "index.html", "icon-192.png"];

    // write appcache manifest
    const manifestLines = [
        `CACHE MANIFEST`,
        `# v${version}`,
        `NETWORK`,
        `"*"`,
        `CACHE`,
    ];
    manifestLines.push(...offlineFiles);
    const manifest = manifestLines.join("\n") + "\n";
    await fs.writeFile(path.join(targetDir, "manifest.appcache"), manifest, "utf8");
    // write service worker
    let swSource = await fs.readFile(path.join(projectDir, "src/service-worker.template.js"), "utf8");
    swSource = swSource.replace(`"%%VERSION%%"`, `"${version}"`);
    swSource = swSource.replace(`"%%FILES%%"`, JSON.stringify(offlineFiles));
    await fs.writeFile(path.join(targetDir, "sw.js"), swSource, "utf8");
    // write web manifest
    const webManifest = {
        name: "Brawl Chat",
        short_name: "Brawl",
        display: "standalone",
        start_url: "index.html",
        icons: [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"}],
    };
    await fs.writeFile(path.join(targetDir, "manifest.json"), JSON.stringify(webManifest), "utf8");
    // copy icon
    let icon = await fs.readFile(path.join(projectDir, "icon.png"));
    await fs.writeFile(path.join(targetDir, "icon-192.png"), icon);
}

async function buildCss() {
    // create css bundle
    const cssMainFile = path.join(projectDir, "src/ui/web/css/main.css");
    const preCss = await fs.readFile(cssMainFile, "utf8");
    const cssBundler = postcss([postcssImport]);
    const postCss = await cssBundler.process(preCss, {from: cssMainFile});
    await fs.writeFile(path.join(targetDir, "brawl.css"), postCss, "utf8");
}


function removeOrEnableScript(scriptNode, enable) {
    if (enable) {
        scriptNode.attr("type", "text/javascript");
    } else {
        scriptNode.remove();
    }
}

async function removeDirIfExists(targetDir) {
    try {
        const files = await fs.readdir(targetDir);
        await Promise.all(files.map(filename => fs.unlink(path.join(targetDir, filename))));
        await fs.rmdir(targetDir);
    } catch (err) {
        if (err.code !== "ENOENT") {
            throw err;
        }
    }
}

build().catch(err => console.error(err));
