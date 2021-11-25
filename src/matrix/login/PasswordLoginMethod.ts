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

import {ILogItem} from "../../logging/types";
import {ILoginMethod} from "./LoginMethod";
import {HomeServerApi} from "../net/HomeServerApi.js";

export class PasswordLoginMethod implements ILoginMethod {
    private readonly _username: string;
    private readonly _password: string;
    public readonly homeserver: string;

    constructor({username, password, homeserver}: {username: string, password: string, homeserver: string}) {
        this._username = username;
        this._password = password;
        this.homeserver = homeserver;
    }

    async login(hsApi: HomeServerApi, deviceName: string, log: ILogItem): Promise<Record<string, any>> {
        return await hsApi.passwordLogin(this._username, this._password, deviceName, {log}).response();
    }
}
