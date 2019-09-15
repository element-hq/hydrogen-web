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

async function build() {
    // clear target dir
    await removeDirIfExists(targetDir);
    await fs.mkdir(targetDir);
    // transform html file
    const devHtml = await fs.readFile(path.join(projectDir, "index.html"), "utf8");
    const doc = cheerio.load(devHtml);
    doc("link[rel=stylesheet]").attr("href", "brawl.css");
    doc("script").replaceWith(
        `<script type="text/javascript" src="brawl.js"></script>` +
        `<script type="text/javascript">main(document.body);</script>`);
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
}

async function removeDirIfExists(targetDir) {
    try {
        const files = await fs.readdir(targetDir);
        await Promise.all(files.map(filename => fs.unlink(path.join(targetDir, filename))));
        await fs.rmdir(targetDir);
    } catch (err) {
        // err.code === ENOENT
        console.log(err);
    }
}

build().catch(err => console.error(err));
