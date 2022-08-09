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

import type {ThemeInformation} from "./types";
import type {ThemeManifest} from "../../../types/theme";
import type {ILogItem} from "../../../../logging/types";
import {ColorSchemePreference} from "./types";

export class BuiltThemeParser {
    private _themeMapping: Record<string, ThemeInformation> = {};
    private _preferredColorScheme?: ColorSchemePreference;

    constructor(preferredColorScheme?: ColorSchemePreference) {
        this._preferredColorScheme = preferredColorScheme;
    }

    parse(manifest: ThemeManifest, manifestLocation: string, log: ILogItem) {
        log.wrap("BuiltThemeParser.parse", () => {
            /*
            After build has finished, the source section of each theme manifest
            contains `built-assets` which is a mapping from the theme-id to
            cssLocation of theme
            */
            const builtAssets: Record<string, string> = manifest.source?.["built-assets"];
            const themeName = manifest.name;
            if (!themeName) {
                throw new Error(`Theme name not found in manifest at ${manifestLocation}`);
            }
            let defaultDarkVariant: any = {}, defaultLightVariant: any = {};
            for (let [themeId, cssLocation] of Object.entries(builtAssets)) {
                try {
                    /**
                     * This cssLocation is relative to the location of the manifest file.
                     * So we first need to resolve it relative to the root of this hydrogen instance.
                     */
                    cssLocation = new URL(cssLocation, new URL(manifestLocation, window.location.origin)).href;
                }
                catch {
                    continue;
                }
                const variant = themeId.match(/.+-(.+)/)?.[1];
                const variantDetails = manifest.values?.variants[variant!];
                if (!variantDetails) {
                    throw new Error(`Variant ${variant} is missing in manifest at ${manifestLocation}`);
                }
                const { name: variantName, default: isDefault, dark } = variantDetails;
                const themeDisplayName = `${themeName} ${variantName}`;
                if (isDefault) {
                    /**
                     * This is a default variant!
                     * We'll add these to the themeMapping (separately) keyed with just the
                     * theme-name (i.e "Element" instead of "Element Dark").
                     * We need to be able to distinguish them from other variants!
                     * 
                     * This allows us to render radio-buttons with "dark" and
                     * "light" options.
                    */
                    const defaultVariant = dark ? defaultDarkVariant : defaultLightVariant;
                    defaultVariant.variantName = variantName;
                    defaultVariant.id = themeId
                    defaultVariant.cssLocation = cssLocation;
                    continue;
                }
                // Non-default variants are keyed in themeMapping with "theme_name variant_name"
                // eg: "Element Dark"
                this._themeMapping[themeDisplayName] = {
                    cssLocation,
                    id: themeId
                };
            }
            if (defaultDarkVariant.id && defaultLightVariant.id) {
                /**
                 * As mentioned above, if there's both a default dark and a default light variant,
                 * add them to themeMapping separately.
                 */
                const defaultVariant = this._preferredColorScheme === ColorSchemePreference.Dark ? defaultDarkVariant : defaultLightVariant;
                this._themeMapping[themeName] = { dark: defaultDarkVariant, light: defaultLightVariant, default: defaultVariant };
            }
            else {
                /**
                 * If only one default variant is found (i.e only dark default or light default but not both),
                 * treat it like any other variant.
                 */
                const variant = defaultDarkVariant.id ? defaultDarkVariant : defaultLightVariant;
                this._themeMapping[`${themeName} ${variant.variantName}`] = { id: variant.id, cssLocation: variant.cssLocation };
            }
         });
    }

    get themeMapping(): Record<string, ThemeInformation> {
        return this._themeMapping;
    }
}
