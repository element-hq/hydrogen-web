/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseMessageTile} from "./BaseMessageTile.js";

export class LocationTile extends BaseMessageTile {
    get shape() {
        return "location";
    }

    get mapsLink() {
        try {
            const url = new URL(this._getContent().geo_uri);
            if (url.protocol !== "geo:") {
                return "";
            }
            const [locationStr, ...namedParams] = url.pathname.split(";");
            const [latStr, longStr] = locationStr.split(",");
            const lat = parseFloat(latStr);
            const long = parseFloat(longStr);
            let uncertainty;
            for (const namedParam of namedParams) {
                const [name, value] = namedParam.split("=");
                if (name === "u") {
                    uncertainty = parseFloat(value);
                }
            }
            if (this.platform.isIOS) {
                return `http://maps.apple.com/?ll=${lat},${long}`;
            } else {
                let uri = `geo:${lat},${long}`;
                if (uncertainty) {
                    uri = uri + `;u=${uncertainty}`;
                }
                return uri;
            }
        } catch {
            return "";
        }
    }

    get label() {
        return this.i18n`${this.displayName} sent their location`;
    }
}
