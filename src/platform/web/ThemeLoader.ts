/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import type {Platform} from "./Platform.js";

export enum COLOR_SCHEME_PREFERENCE { DARK, LIGHT, }

export class ThemeLoader {
    private _platform: Platform;
    private _themeMapping: Record<string, string> = {};

    constructor(platform: Platform) {
        this._platform = platform;
    }

    async init(manifestLocations: string[]): Promise<void> {
        for (const manifestLocation of manifestLocations) {
            const { body } = await this._platform
                .request(manifestLocation, {
                    method: "GET",
                    format: "json",
                    cache: true,
                })
                .response();
            /*
            After build has finished, the source section of each theme manifest
            contains `built-asset` which is a mapping from the theme-name to the
            location of the css file in build.
            */
            Object.assign(this._themeMapping, body["source"]["built-asset"]);
        }
    }

    setTheme(themeName: string) {
        const themeLocation = this._themeMapping[themeName];
        if (!themeLocation) {
            throw new Error( `Cannot find theme location for theme "${themeName}"!`);
        }
        this._platform.replaceStylesheet(themeLocation);
        this._platform.settingsStorage.setString("theme", themeName);
    }

    get themes(): string[] {
        return Object.keys(this._themeMapping);
    }

    async getActiveTheme(): Promise<string|undefined> {
        // check if theme is set via settings
        let theme = await this._platform.settingsStorage.getString("theme");
        if (theme) {
            return theme;
        }
        // return default theme
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
            return this._platform.config["defaultTheme"].dark;
        } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
            return this._platform.config["defaultTheme"].light;
        }
        return undefined;
    }
}
