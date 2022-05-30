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

import type {ILogItem} from "../../logging/types.js";
import type {Platform} from "./Platform.js";

type NormalVariant = {
    id: string;
    cssLocation: string;
};

type DefaultVariant = {
    dark: {
        id: string;
        cssLocation: string;
        variantName: string;
    };
    light: {
        id: string;
        cssLocation: string;
        variantName: string;
    };
}

type ThemeInformation = NormalVariant | DefaultVariant; 

export class ThemeLoader {
    private _platform: Platform;
    private _themeMapping: Record<string, ThemeInformation>;

    constructor(platform: Platform) {
        this._platform = platform;
    }

    async init(manifestLocations: string[]): Promise<void> {
        this._themeMapping = {};
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
            contains `built-assets` which is a mapping from the theme-name to theme
            information which includes the location of the CSS file.
            (see type ThemeInformation above)
            */
            Object.assign(this._themeMapping, body["source"]["built-assets"]);
            //Add the default-theme as an additional option to the mapping
            const defaultThemeId = this.getDefaultTheme();
            if (defaultThemeId) {
                const cssLocation = this._findThemeLocationFromId(defaultThemeId);
                if (cssLocation) {
                    this._themeMapping["Default"] = { id: "default", cssLocation };
                }
            }
        }
    }

    setTheme(themeId: string, log?: ILogItem) {
        this._platform.logger.wrapOrRun(log, {l: "change theme", id: themeId}, () => {
            const themeLocation = this._findThemeLocationFromId(themeId);
            if (!themeLocation) {
                throw new Error( `Cannot find theme location for theme "${themeId}"!`);
            }
            this._platform.replaceStylesheet(themeLocation);
            this._platform.settingsStorage.setString("theme", themeId);
         });
    }

    get themeMapping(): Record<string, ThemeInformation> {
        return this._themeMapping;
    }

    async getActiveTheme(): Promise<string> {
        const theme = await this._platform.settingsStorage.getString("theme") ?? "default";
        if (theme) {
            return theme;
        }
        throw new Error("Cannot find active theme!");
    }

    getDefaultTheme(): string | undefined {
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
            return this._platform.config["defaultTheme"].dark;
        } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
            return this._platform.config["defaultTheme"].light;
        }
    }

    private _findThemeLocationFromId(themeId: string): string | undefined {
        for (const themeData of Object.values(this._themeMapping)) {
            if ("id" in themeData && themeData.id === themeId) {
                return themeData.cssLocation;
            }
            else if ("light" in themeData && themeData.light?.id === themeId) {
                return themeData.light.cssLocation;
            }
            else if ("dark" in themeData && themeData.dark?.id === themeId) {
                return themeData.dark.cssLocation;
            }
        }
    }
}
