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

export function getColoredSvgString(svgString, primaryColor, secondaryColor) {
    let coloredSVGCode = svgString.replaceAll("#ff00ff", primaryColor);
    coloredSVGCode = coloredSVGCode.replaceAll("#00ffff", secondaryColor);
    if (svgString === coloredSVGCode) {
        throw new Error("svg-colorizer made no color replacements! The input svg should only contain colors #ff00ff (primary, case-sensitive) and #00ffff (secondary, case-sensitive).");
    }
    return coloredSVGCode;
}
