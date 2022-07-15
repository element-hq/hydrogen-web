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
import type {ThemeInformation} from "./ThemeLoader";
import type {Platform} from "./Platform.js";
import {ColorSchemePreference} from "./ThemeLoader";
import {IconColorizer} from "./IconColorizer";
import {DerivedVariables} from "./DerivedVariables";

export class ThemeBuilder {
    // todo: replace any with manifest type when PR is merged
    private _idToManifest: Map<string, any>;
    private _themeMapping: Record<string, ThemeInformation> = {};
    private _preferredColorScheme?: ColorSchemePreference;
    private _platform: Platform;
    private _injectedVariables?: Record<string, string>;

    constructor(platform: Platform, manifestMap: Map<string, any>, preferredColorScheme?: ColorSchemePreference) {
        this._idToManifest = manifestMap;
        this._preferredColorScheme = preferredColorScheme;
        this._platform = platform;
    }

    async populateDerivedTheme(manifest) {
        const { manifest: baseManifest, location } = this._idToManifest.get(manifest.extends);
        const runtimeCssLocation = baseManifest.source?.["runtime-asset"];
        const cssLocation = new URL(runtimeCssLocation, new URL(location, window.location.origin)).href;
        const derivedVariables = baseManifest.source?.["derived-variables"];
        const icons = baseManifest.source?.["icon"];
        const themeName = manifest.name;
        let defaultDarkVariant: any = {}, defaultLightVariant: any = {};
        for (const [variant, variantDetails] of Object.entries(manifest.values.variants) as [string, any][]) {
            try {
                const themeId = `${manifest.id}-${variant}`;
                const { name: variantName, default: isDefault, dark, variables } = variantDetails;
                const resolvedVariables = new DerivedVariables(variables, derivedVariables, dark).toVariables();
                Object.assign(variables, resolvedVariables);
                const iconVariables = await new IconColorizer(this._platform, icons, variables, location).toVariables();
                Object.assign(variables, resolvedVariables, iconVariables);
                const themeDisplayName = `${themeName} ${variantName}`;
                if (isDefault) {
                    const defaultVariant = dark ? defaultDarkVariant : defaultLightVariant;
                    Object.assign(defaultVariant, { variantName, id: themeId, cssLocation, variables });
                    continue;
                }
                this._themeMapping[themeDisplayName] = { cssLocation, id: themeId, variables: variables, };
            }
            catch (e) {
                console.error(e);
                continue;
            }
        }
        if (defaultDarkVariant.id && defaultLightVariant.id) {
            const defaultVariant = this._preferredColorScheme === ColorSchemePreference.Dark ? defaultDarkVariant : defaultLightVariant;
            this._themeMapping[themeName] = { dark: defaultDarkVariant, light: defaultLightVariant, default: defaultVariant };
        }
        else {
            const variant = defaultDarkVariant.id ? defaultDarkVariant : defaultLightVariant;
            this._themeMapping[`${themeName} ${variant.variantName}`] = { id: variant.id, cssLocation: variant.cssLocation };
        }
    }

    get themeMapping() {
        return this._themeMapping;
    }

    injectCSSVariables(variables: Record<string, string>) {
        const root = document.documentElement;
        for (const [variable, value] of Object.entries(variables)) {
            root.style.setProperty(`--${variable}`, value);
        }
        this._injectedVariables = variables;
    }

    removePreviousCSSVariables() {
        if (!this._injectedVariables) {
            return;
        }
        const root = document.documentElement;
        for (const variable of Object.keys(this._injectedVariables)) {
            root.style.removeProperty(`--${variable}`);
        }
        this._injectedVariables = undefined;
    }
}
