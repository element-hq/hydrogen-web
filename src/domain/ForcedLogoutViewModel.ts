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

export class ForcedLogoutViewModel extends ViewModel<SegmentType, Options> {
    private _sessionId: string;
    private _error?: Error;
    private _logoutPromise: Promise<void>;

    constructor(options: Options) {
        super(options);
        this._sessionId = options.sessionId;
        this._logoutPromise = this.forceLogout();
    }

    async forceLogout(): Promise<void> {
        try {
            const client = new Client(this.platform);
            await client.startForcedLogout(this._sessionId);
        }
        catch (err) {
            this._error = err;
            this.emitChange("error");
        }
    }

    async proceed(): Promise<void> {
        await this._logoutPromise;
        this.navigation.push("session", true);
    }

    get error(): string | undefined {
        if (this._error) {
            return this.i18n`Could not log out of device: ${this._error.message}`;
        }
    }
}
