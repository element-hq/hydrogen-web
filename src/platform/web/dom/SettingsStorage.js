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

export class SettingsStorage {
    constructor(prefix) {
        this._prefix = prefix;
    }

    async setInt(key, value) {
        window.localStorage.setItem(`${this._prefix}${key}`, value);
    }

    async getInt(key) {
        const value = window.localStorage.getItem(`${this._prefix}${key}`);
        if (typeof value === "string") {
            return parseInt(value, 10);
        }
        return;
    }

    async remove(key) {
        window.localStorage.removeItem(`${this._prefix}${key}`);
    }
}
