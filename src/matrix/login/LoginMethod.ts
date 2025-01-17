/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {ILogItem} from "../../logging/types";
import type {HomeServerApi} from "../net/HomeServerApi.js";

export interface ILoginMethod {
    homeserver: string;
    login(hsApi: HomeServerApi, deviceName: string, log: ILogItem): Promise<Record<string, any>>;
}
