/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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
