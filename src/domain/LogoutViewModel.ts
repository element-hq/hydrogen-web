/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {Options as BaseOptions, ViewModel} from "./ViewModel";
import {Client} from "../matrix/Client.js";
import {SegmentType} from "./navigation/index";

type Options = { sessionId: string; } & BaseOptions;

export class LogoutViewModel extends ViewModel<SegmentType, Options> {
    private _sessionId: string;
    private _busy: boolean;
    private _showConfirm: boolean;
    private _error?: Error;

    constructor(options: Options) {
        super(options);
        this._sessionId = options.sessionId;
        this._busy = false;
        this._showConfirm = true;
        this._error = undefined;
    }

    get showConfirm(): boolean {
        return this._showConfirm;
    }

    get busy(): boolean {
        return this._busy;
    }

    get cancelUrl(): string | undefined {
        return this.urlCreator.urlForSegment("session", true);
    }

    async logout(): Promise<void> {
        this._busy = true;
        this._showConfirm = false;
        this.emitChange("busy");
        try {
            const client = new Client(this.platform);
            await client.startLogout(this._sessionId);
            this.navigation.push("session", true);
        } catch (err) {
            this._error = err;
            this._busy = false;
            this.emitChange("busy");
        }
    }

    get status(): string {
        if (this._error) {
            return this.i18n`Could not log out of device: ${this._error.message}`;
        } else {
            return this.i18n`Logging out… Please don't close the app.`;
        }
    }
}
