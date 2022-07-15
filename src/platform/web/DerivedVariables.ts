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
import {derive} from "../../../scripts/postcss/color.mjs";

export class DerivedVariables {
    private _baseVariables: Record<string, string>;
    private _variablesToDerive: string[]
    private _isDark: boolean

    constructor(baseVariables: Record<string, string>, variablesToDerive: string[], isDark: boolean) {
        this._baseVariables = baseVariables;
        this._variablesToDerive = variablesToDerive;
        this._isDark = isDark;
    }

    toVariables(): Record<string, string> {
        const aliases: any = {};
        const resolvedVariables: any = {};
        const RE_VARIABLE_VALUE = /(.+)--(.+)-(.+)/;
        for (const variable of this._variablesToDerive) {
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
                const value = this._baseVariables[baseVariable];
                const resolvedValue = derive(value, operation, argument, this._isDark);
                resolvedVariables[variable] = resolvedValue;
            }
        }
        for (const [alias, variable] of Object.entries(aliases) as any) {
            resolvedVariables[alias] = this._baseVariables[variable] ?? resolvedVariables[variable];
        }
        return resolvedVariables;
    }
}
