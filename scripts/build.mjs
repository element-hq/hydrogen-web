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

const jsPostfix = `
window.DEBUG = true;
let buf = "";
console.error = (...params) => {
    const lastLines = "...\\n" + buf.split("\\n").slice(-10).join("\\n");
    // buf = buf + "ERR " + params.join(" ") + "\\n";
    // const location = new Error().stack.split("\\n")[2];
    alert(params.join(" ") +"\\n...\\n" + lastLines);
};
console.log = console.info = console.warn = (...params) => {
    buf = buf + params.join(" ") + "\\n";
};
`;

const jsSuffix = `
setTimeout(() => {
    const showlogs = document.getElementById("showlogs");
    showlogs.addEventListener("click", () => {
        const lastLines = "...\\n" + buf.split("\\n").slice(-20).join("\\n");
        alert(lastLines);
    }, true);
    showlogs.innerText = "Show last 20 log lines";
}, 10000);
`;

async function build() {
    // get version number
    const version = JSON.parse(await fs.readFile(path.join(projectDir, "package.json"), "utf8")).version;
    // clear target dir
    await removeDirIfExists(targetDir);
    await fs.mkdir(targetDir);
    // transform html file
    const devHtml = await fs.readFile(path.join(projectDir, "index.html"), "utf8");
    const doc = cheerio.load(devHtml);
    doc("link[rel=stylesheet]").attr("href", "brawl.css");
    // doc("html").attr("manifest", "manifest.appcache");
    doc("script").replaceWith(
        `<script type="text/javascript" src="brawl.js"></script>` +
        `<script type="text/javascript">${jsPostfix} main(document.body); ${jsSuffix}</script>`);
    await fs.writeFile(path.join(targetDir, "index.html"), doc.html(), "utf8");
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
    // create css bundle
    const cssMainFile = path.join(projectDir, "src/ui/web/css/main.css");
    const preCss = await fs.readFile(cssMainFile, "utf8");
    const cssBundler = postcss([postcssImport]);
    const postCss = await cssBundler.process(preCss, {from: cssMainFile});
    await fs.writeFile(path.join(targetDir, "brawl.css"), postCss, "utf8");
    // write appcache manifest
    const manifestLines = [
        `CACHE MANIFEST`,
        `# v${version}`,
        "brawl.js",
        "brawl.css",
        "index.html",
        ""  
    ];
    await fs.writeFile(path.join(targetDir, "manifest.appcache"), manifestLines.join("\n"), "utf8");
    console.log(`built brawl ${version} successfully`);
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
