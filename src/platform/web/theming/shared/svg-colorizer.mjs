/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export function getColoredSvgString(svgString, primaryColor, secondaryColor) {
    let coloredSVGCode = svgString.replaceAll("#ff00ff", primaryColor);
    coloredSVGCode = coloredSVGCode.replaceAll("#00ffff", secondaryColor);
    if (svgString === coloredSVGCode) {
        throw new Error("svg-colorizer made no color replacements! The input svg should only contain colors #ff00ff (primary, case-sensitive) and #00ffff (secondary, case-sensitive).");
    }
    return coloredSVGCode;
}
