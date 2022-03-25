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

const fs = require("fs");
const path = require("path");
/**
 * Builds a new svg with the colors replaced and returns its location.
 * @param {string} svgLocation The location of the input svg file
 * @param {string} primaryColor Primary color for the new svg
 * @param {string} secondaryColor Secondary color for the new svg
 */
module.exports.buildColorizedSVG = function (svgLocation, primaryColor, secondaryColor) {
    const svgCode = fs.readFileSync(svgLocation, { encoding: "utf8"});
    let coloredSVGCode = svgCode.replaceAll("#ff00ff", primaryColor);
    coloredSVGCode = coloredSVGCode.replaceAll("#00ffff", secondaryColor);
    const fileName = svgLocation.match(/.+\/(.+\.svg)/)[1];
    const outputPath = path.resolve(__dirname, "../../.tmp");
    try {
       fs.mkdirSync(outputPath);
    }
    catch (e) {
        if (e.code !== "EEXIST") {
            throw e;
        }
    }
    const outputFile = `${outputPath}/${fileName}`;
    fs.writeFileSync(outputFile, coloredSVGCode);
    return outputFile;
}
