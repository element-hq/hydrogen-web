/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {readFileSync, mkdirSync, writeFileSync} from "fs";
import {resolve} from "path";
import {h32} from "xxhashjs";
import {getColoredSvgString} from "../../src/platform/web/theming/shared/svg-colorizer.mjs";

function createHash(content) {
    const hasher = new h32(0);
    hasher.update(content);
    return hasher.digest();
}

/**
 * Builds a new svg with the colors replaced and returns its location.
 * @param {string} svgLocation The location of the input svg file
 * @param {string} primaryColor Primary color for the new svg
 * @param {string} secondaryColor Secondary color for the new svg
 */
export function buildColorizedSVG(svgLocation, primaryColor, secondaryColor) {
    const svgCode = readFileSync(svgLocation, { encoding: "utf8"});
    const coloredSVGCode = getColoredSvgString(svgCode, primaryColor, secondaryColor);
    const fileName = svgLocation.match(/.+[/\\](.+\.svg)/)[1];
    const outputName = `${fileName.substring(0, fileName.length - 4)}-${createHash(coloredSVGCode)}.svg`;
    const outputPath = resolve(__dirname, "../../.tmp");
    try {
       mkdirSync(outputPath);
    }
    catch (e) {
        if (e.code !== "EEXIST") {
            throw e;
        }
    }
    const outputFile = `${outputPath}/${outputName}`;
    writeFileSync(outputFile, coloredSVGCode);
    return outputFile;
}
