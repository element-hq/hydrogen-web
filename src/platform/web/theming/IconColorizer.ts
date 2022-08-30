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
import type {Platform} from "../Platform.js";
import {getColoredSvgString} from "./shared/svg-colorizer.mjs";

type ParsedStructure = {
    [variableName: string]: {
        svg: Promise<{ status: number; body: string }>;
        primary: string | null;
        secondary: string | null;
    };
};

export class IconColorizer {
    private _iconVariables: Record<string, string>;
    private _resolvedVariables: Record<string, string>;
    private _manifestLocation: string;
    private _platform: Platform;

    constructor(platform: Platform, iconVariables: Record<string, string>, resolvedVariables: Record<string, string>, manifestLocation: string) {
        this._platform = platform;
        this._iconVariables = iconVariables;
        this._resolvedVariables = resolvedVariables;
        this._manifestLocation = manifestLocation;
    }

    async toVariables(): Promise<Record<string, string>> {
        const { parsedStructure, promises } = await this._fetchAndParseIcons();
        await Promise.all(promises);
        return this._produceColoredIconVariables(parsedStructure);
    }

    private async _fetchAndParseIcons(): Promise<{ parsedStructure: ParsedStructure, promises: any[] }> {
        const promises: any[] = [];
        const parsedStructure: ParsedStructure = {};
        for (const [variable, url] of Object.entries(this._iconVariables)) {
            const urlObject = new URL(`https://${url}`);
            const pathWithoutQueryParams = urlObject.hostname;
            const relativePath = new URL(pathWithoutQueryParams, new URL(this._manifestLocation, window.location.origin));
            const responsePromise = this._platform.request(relativePath, { method: "GET", format: "text", cache: true, }).response()
            promises.push(responsePromise);
            const searchParams = urlObject.searchParams;
            parsedStructure[variable] = {
                svg: responsePromise,
                primary: searchParams.get("primary"),
                secondary: searchParams.get("secondary")
            };
        }
        return { parsedStructure, promises };
    }

    private async _produceColoredIconVariables(parsedStructure: ParsedStructure): Promise<Record<string, string>> {
        let coloredVariables: Record<string, string> = {};
        for (const [variable, { svg, primary, secondary }] of Object.entries(parsedStructure)) {
            const { body: svgCode } = await svg;
            if (!primary) {
                throw new Error(`Primary color variable ${primary} not in list of variables!`);
            }
            const primaryColor = this._resolvedVariables[primary], secondaryColor = this._resolvedVariables[secondary!];
            const coloredSvgCode = getColoredSvgString(svgCode, primaryColor, secondaryColor);
            const dataURI = `url('data:image/svg+xml;utf8,${encodeURIComponent(coloredSvgCode)}')`;
            coloredVariables[variable] = dataURI;
        }
        return coloredVariables;
    }
}
