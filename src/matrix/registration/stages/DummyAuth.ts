/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {AuthenticationData} from "../types";
import {BaseRegistrationStage} from "./BaseRegistrationStage";

export class DummyAuth extends BaseRegistrationStage {
    generateAuthenticationData(): AuthenticationData {
        return {
            session: this._session,
            type: this.type,
        };    
    }

    get type(): string {
        return "m.login.dummy";
    }
}
