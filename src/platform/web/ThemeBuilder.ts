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
import {ColorSchemePreference} from "./ThemeLoader";
import {offColor} from 'off-color';

function derive(value, operation, argument, isDark) {
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
    }
}

export class ThemeBuilder {
    // todo: replace any with manifest type when PR is merged
    private _idToManifest: Map<string, any>;
    private _themeMapping: Record<string, ThemeInformation> = {};
    private _themeToVariables: Record<string, any> = {};
    private _preferredColorScheme?: ColorSchemePreference;

    constructor(manifestMap: Map<string, any>, preferredColorScheme?: ColorSchemePreference) {
        this._idToManifest = manifestMap;
        this._preferredColorScheme = preferredColorScheme;
    }

    populateDerivedTheme(manifest) {
        const { manifest: baseManifest, location } = this._idToManifest.get(manifest.extends);
        const runtimeCssLocation = baseManifest.source?.["runtime-asset"];
        const cssLocation = new URL(runtimeCssLocation, new URL(location, window.location.origin)).href;
        const derivedVariables = baseManifest.source?.["derived-variables"];
        const themeName = manifest.name;
        let defaultDarkVariant: any = {}, defaultLightVariant: any = {};
        for (const [variant, variantDetails] of Object.entries(manifest.values.variants) as [string, any][]) {
            const themeId = `${manifest.id}-${variant}`;
            const { name: variantName, default: isDefault, dark, variables } = variantDetails;
            const resolvedVariables = this.deriveVariables(variables, derivedVariables, dark);
            console.log("resolved", resolvedVariables);
            Object.assign(variables, resolvedVariables);
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
                defaultVariant.id = themeId;
                defaultVariant.cssLocation = cssLocation;
                defaultVariant.variables = variables;
                continue;
            }
            // Non-default variants are keyed in themeMapping with "theme_name variant_name"
            // eg: "Element Dark"
            this._themeMapping[themeDisplayName] = {
                cssLocation,
                id: themeId,
                variables: variables,
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
    }

    get themeMapping() {
        return this._themeMapping;
    }

    injectCSSVariables(variables: Record<string, string>) {
        const root = document.documentElement;
        for (const [variable, value] of Object.entries(variables)) {
            root.style.setProperty(`--${variable}`, value);
        }
    }

    removeCSSVariables(variables: string[]) {
        const root = document.documentElement;
        for (const variable of variables) {
            root.style.removeProperty(`--${variable}`);
        }
    }

    deriveVariables(variables: Record<string, string>, derivedVariables: string[], isDark: boolean) {
        const aliases: any = {};
        const resolvedVariables: any = {};
        const RE_VARIABLE_VALUE = /(.+)--(.+)-(.+)/;
        for (const variable of derivedVariables) {
            // If this is an alias, store it for processing later
            const [alias, value] = variable.split("=");
            if (value) {
                aliases[alias] = value;
                continue;
            }
            // Resolve derived variables
            const matches = variable.match(RE_VARIABLE_VALUE);
            if (matches) {
                const [, baseVariable, operation, argument] = matches;
                const value = variables[baseVariable];
                const resolvedValue = derive(value, operation, argument, isDark);
                resolvedVariables[variable] = resolvedValue;
            }
        }
        for (const [alias, variable] of Object.entries(aliases) as any) {
            resolvedVariables[alias] = variables[variable] ?? resolvedVariables[variable];
        }
        return resolvedVariables;
    }
}
