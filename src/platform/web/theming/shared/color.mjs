/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import * as pkg from 'off-color';
const offColor = pkg.offColor ?? pkg.default.offColor;

export function derive(value, operation, argument, isDark) {
    const argumentAsNumber = parseInt(argument);
    if (isDark) {
        // For dark themes, invert the operation
        if (operation === 'darker') {
            operation = "lighter";
        }
        else if (operation === 'lighter') {
            operation = "darker";
        }
    }
    switch (operation) {
        case "darker": {
            const newColorString = offColor(value).darken(argumentAsNumber / 100).hex();
            return newColorString;
        }
        case "lighter": {
            const newColorString = offColor(value).lighten(argumentAsNumber / 100).hex();
            return newColorString;
        }
        case "alpha": {
            return offColor(value).rgba(argumentAsNumber / 100);
        }
    }
}
