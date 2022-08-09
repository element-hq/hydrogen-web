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
import {derive} from "./shared/color.mjs";

export class DerivedVariables {
    private _baseVariables: Record<string, string>;
    private _variablesToDerive: string[]
    private _isDark: boolean
    private _aliases: Record<string, string> = {};
    private _derivedAliases: string[] = [];

    constructor(baseVariables: Record<string, string>, variablesToDerive: string[], isDark: boolean) {
        this._baseVariables = baseVariables;
        this._variablesToDerive = variablesToDerive;
        this._isDark = isDark;
    }

    toVariables(): Record<string, string> {
        const resolvedVariables: any = {};
        this._detectAliases();
        for (const variable of this._variablesToDerive) {
            const resolvedValue = this._derive(variable);
            if (resolvedValue) {
                resolvedVariables[variable] = resolvedValue;
            }
        }
        for (const [alias, variable] of Object.entries(this._aliases) as any) {
            resolvedVariables[alias] = this._baseVariables[variable] ?? resolvedVariables[variable];
        }
        for (const variable of this._derivedAliases) {
            const resolvedValue = this._deriveAlias(variable, resolvedVariables);
            if (resolvedValue) {
                resolvedVariables[variable] = resolvedValue;
            }
        }
        return resolvedVariables;
    }

    private _detectAliases(): void {
        const newVariablesToDerive: string[] = [];
        for (const variable of this._variablesToDerive) {
            const [alias, value] = variable.split("=");
            if (value) {
                this._aliases[alias] = value;
            }
            else {
                newVariablesToDerive.push(variable);
            }
        }
        this._variablesToDerive = newVariablesToDerive;
    }

    private _derive(variable: string): string | undefined {
        const RE_VARIABLE_VALUE = /(.+)--(.+)-(.+)/;
        const matches = variable.match(RE_VARIABLE_VALUE);
        if (matches) {
            const [, baseVariable, operation, argument] = matches;
            const value = this._baseVariables[baseVariable];
            if (!value ) {
                if (this._aliases[baseVariable]) {
                    this._derivedAliases.push(variable);
                    return;
                }
                else {
                    throw new Error(`Cannot find value for base variable "${baseVariable}"!`);
                }
            }
            const resolvedValue = derive(value, operation, argument, this._isDark);
            return resolvedValue;
        }
    }

    private _deriveAlias(variable: string, resolvedVariables: Record<string, string>): string | undefined {
        const RE_VARIABLE_VALUE = /(.+)--(.+)-(.+)/;
        const matches = variable.match(RE_VARIABLE_VALUE);
        if (matches) {
            const [, baseVariable, operation, argument] = matches;
            const value = resolvedVariables[baseVariable];
            if (!value ) {
                throw new Error(`Cannot find value for alias "${baseVariable}" when trying to derive ${variable}!`);
            }
            const resolvedValue = derive(value, operation, argument, this._isDark);
            return resolvedValue;
        }
    }
}

import * as pkg from "off-color";
// @ts-ignore 
const offColor = pkg.offColor ?? pkg.default.offColor;

export function tests() {
    return {
        "Simple variable derivation": assert => {
            const deriver = new DerivedVariables({ "background-color": "#ff00ff" }, ["background-color--darker-5"], false);
            const result = deriver.toVariables();
            const resultColor = offColor("#ff00ff").darken(5/100).hex();
            assert.deepEqual(result, {"background-color--darker-5": resultColor});
        },

        "For dark themes, lighten and darken are inverted": assert => {
            const deriver = new DerivedVariables({ "background-color": "#ff00ff" }, ["background-color--darker-5"], true);
            const result = deriver.toVariables();
            const resultColor = offColor("#ff00ff").lighten(5/100).hex();
            assert.deepEqual(result, {"background-color--darker-5": resultColor});
        },

        "Aliases can be derived": assert => {
            const deriver = new DerivedVariables({ "background-color": "#ff00ff" }, ["my-awesome-alias=background-color","my-awesome-alias--darker-5"], false);
            const result = deriver.toVariables();
            const resultColor = offColor("#ff00ff").darken(5/100).hex();
            assert.deepEqual(result, {
                "my-awesome-alias": "#ff00ff",
                "my-awesome-alias--darker-5": resultColor,
            });
        },
    }
}
