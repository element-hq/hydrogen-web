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

import {makeTxnId} from "../common.js";
import {ILogItem} from "../../logging/types";
import {ILoginMethod} from "./LoginMethod";
import {HomeServerApi} from "../net/HomeServerApi.js";

export class TokenLoginMethod implements ILoginMethod {
    private readonly _loginToken: string;
    public readonly homeserver: string;

    constructor({ homeserver, loginToken }: { homeserver: string, loginToken: string}) {
        this.homeserver = homeserver;
        this._loginToken = loginToken;
    }

    async login(hsApi: HomeServerApi, deviceName: string, log: ILogItem): Promise<Record<string, any>> {
        return await hsApi.tokenLogin(this._loginToken, makeTxnId(), deviceName, {log}).response();
    }
}
