import fsRoot from "fs";
const fs = fsRoot.promises;

export async function removeDirIfExists(targetDir) {
    try {
        await fs.rm(targetDir, {recursive: true});
    } catch (err) {
        if (err.code !== "ENOENT") {
            throw err;
        }
    }
}
