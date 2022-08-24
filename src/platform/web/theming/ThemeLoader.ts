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

import {RuntimeThemeParser} from "./parsers/RuntimeThemeParser";
import {ColorSchemePreference} from "./parsers/types";
import {BuiltThemeParser} from "./parsers/BuiltThemeParser";
import type {Variant, ThemeInformation} from "./parsers/types";
import type {ThemeManifest} from "../../types/theme";
import type {ILogItem} from "../../../logging/types";
import type {Platform} from "../Platform.js";
import {LogLevel} from "../../../logging/LogFilter";

export class ThemeLoader {
    private _platform: Platform;
    private _themeMapping: Record<string, ThemeInformation>;
    private _injectedVariables?: Record<string, string>;

    constructor(platform: Platform) {
        this._platform = platform;
    }

    async init(manifestLocations: string[], log?: ILogItem): Promise<void> {
        await this._platform.logger.wrapOrRun(log, "ThemeLoader.init", async (log) => {
            let noManifestsAvailable = true;
            const failedManifestLoads: string[] = [];
            const parseErrors: string[] = [];
            const results = await Promise.all(
                manifestLocations.map(location => this._platform.request(location, { method: "GET", format: "json", cache: true, }).response())
            );
            const runtimeThemeParser = new RuntimeThemeParser(this._platform, this.preferredColorScheme);
            const builtThemeParser = new BuiltThemeParser(this.preferredColorScheme);
            const runtimeThemePromises: Promise<void>[] = [];
            for (let i = 0; i < results.length; ++i) {
                const result = results[i];
                const { status, body } = result;
                if (!(status >= 200 && status <= 299)) {
                    console.error(`Failed to load manifest at ${manifestLocations[i]}, status: ${status}`);
                    log.log({ l: "Manifest fetch failed", location: manifestLocations[i], status }, LogLevel.Error);
                    failedManifestLoads.push(manifestLocations[i])
                    continue;
                }
                noManifestsAvailable = false;
                try {
                    if (body.extends) {
                        const indexOfBaseManifest = results.findIndex(result => "value" in result && result.value.body.id === body.extends);
                        if (indexOfBaseManifest === -1) {
                            throw new Error(`Base manifest for derived theme at ${manifestLocations[i]} not found!`);
                        }
                        const { body: baseManifest } = (results[indexOfBaseManifest] as PromiseFulfilledResult<{ body: ThemeManifest }>).value;
                        const baseManifestLocation = manifestLocations[indexOfBaseManifest];
                        const promise = runtimeThemeParser.parse(body, baseManifest, baseManifestLocation, log);
                        runtimeThemePromises.push(promise);
                    }
                    else {
                        builtThemeParser.parse(body, manifestLocations[i], log);
                    }
                }
                catch(e) {
                    console.error(e);
                    parseErrors.push(e.message);
                }
            }
            await Promise.all(runtimeThemePromises);
            this._themeMapping = { ...builtThemeParser.themeMapping, ...runtimeThemeParser.themeMapping };
            if (noManifestsAvailable) {
                // We need at least one working theme manifest!
                throw new Error(`All configured theme manifests failed to load, the following were tried: ${failedManifestLoads.join(", ")}`);
            }
            else if (Object.keys(this._themeMapping).length === 0 && parseErrors.length) {
                // Something is wrong..., themeMapping is empty!
                throw new Error(`Failed to parse theme manifests, the following errors were encountered: ${parseErrors.join(", ")}`);
            }
            this._addDefaultThemeToMapping(log);
            log.log({ l: "Preferred colorscheme", scheme: this.preferredColorScheme === ColorSchemePreference.Dark ? "dark" : "light" });
            log.log({ l: "Result", themeMapping: this._themeMapping });
        });
    }

    async setTheme(themeName: string, themeVariant?: "light" | "dark" | "default", log?: ILogItem) {
        await this._platform.logger.wrapOrRun(log, { l: "change theme", name: themeName, variant: themeVariant }, async (l) => {
            let cssLocation: string, variables: Record<string, string>;
            let themeDetails = this._themeMapping[themeName];
            if ("id" in themeDetails) {
                cssLocation = themeDetails.cssLocation;
                variables = themeDetails.variables;
            }
            else {
                if (!themeVariant) {
                    throw new Error("themeVariant is undefined!");
                }
                cssLocation = themeDetails[themeVariant].cssLocation;
                variables = themeDetails[themeVariant].variables;
            }
            await this._platform.replaceStylesheet(cssLocation, l);
            if (variables) {
                log?.log({l: "Derived Theme", variables});
                this._injectCSSVariables(variables);
            }
            else {
                this._removePreviousCSSVariables();
            }
            this._platform.settingsStorage.setString("theme-name", themeName);
            if (themeVariant) {
                this._platform.settingsStorage.setString("theme-variant", themeVariant);
            }
            else {
                this._platform.settingsStorage.remove("theme-variant");
            }
        });
    }

    private _injectCSSVariables(variables: Record<string, string>): void {
        const root = document.documentElement;
        for (const [variable, value] of Object.entries(variables)) {
            root.style.setProperty(`--${variable}`, value);
        }
        this._injectedVariables = variables;
    }

    private _removePreviousCSSVariables(): void {
        if (!this._injectedVariables) {
            return;
        }
        const root = document.documentElement;
        for (const variable of Object.keys(this._injectedVariables)) {
            root.style.removeProperty(`--${variable}`);
        }
        this._injectedVariables = undefined;
    }

    /** Maps theme display name to theme information */
    get themeMapping(): Record<string, ThemeInformation> {
        return this._themeMapping;
    }

    async getActiveTheme(): Promise<{themeName: string, themeVariant?: string}> {
        let themeName = await this._platform.settingsStorage.getString("theme-name");
        let themeVariant = await this._platform.settingsStorage.getString("theme-variant");
        if (!themeName || !this._themeMapping[themeName]) {
            themeName = "Default" in this._themeMapping ? "Default" : Object.keys(this._themeMapping)[0];
            if (!this._themeMapping[themeName][themeVariant]) {
                themeVariant = "default" in this._themeMapping[themeName] ? "default" : undefined;
            }
        }
        return { themeName, themeVariant };
    }

    getDefaultTheme(): string | undefined {
        switch (this.preferredColorScheme) {
            case ColorSchemePreference.Dark:
                return this._platform.config["defaultTheme"]?.dark;
            case ColorSchemePreference.Light:
                return this._platform.config["defaultTheme"]?.light;
        }
    }

    private _findThemeDetailsFromId(themeId: string): {themeName: string, themeData: Partial<Variant>} | undefined {
        for (const [themeName, themeData] of Object.entries(this._themeMapping)) {
            if ("id" in themeData && themeData.id === themeId) {
                return { themeName, themeData };
            }
            else if ("light" in themeData && themeData.light?.id === themeId) {
                return { themeName, themeData: themeData.light };
            }
            else if ("dark" in themeData && themeData.dark?.id === themeId) {
                return { themeName, themeData: themeData.dark };
            }
        }
    }

    private _addDefaultThemeToMapping(log: ILogItem) {
        log.wrap("addDefaultThemeToMapping", l => { 
            const defaultThemeId = this.getDefaultTheme();
            if (defaultThemeId) {
                const themeDetails = this._findThemeDetailsFromId(defaultThemeId);
                if (themeDetails) {
                    this._themeMapping["Default"] = { id: "default", cssLocation: themeDetails.themeData.cssLocation! };
                    const variables = themeDetails.themeData.variables;
                    if (variables) {
                        this._themeMapping["Default"].variables = variables;
                    }
                }
            }
            l.log({ l: "Default Theme", theme: defaultThemeId});
        });
    }

    get preferredColorScheme(): ColorSchemePreference | undefined {
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
            return ColorSchemePreference.Dark;
        }
        else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
            return ColorSchemePreference.Light;
        }
    }
}
