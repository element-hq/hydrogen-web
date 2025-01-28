/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import type {ILogItem} from "../../../logging/types";
import type {MacMethod} from "./stages/constants";

const macMethods: Record<MacMethod, string> = {
    "hkdf-hmac-sha256": "calculate_mac",
    "org.matrix.msc3783.hkdf-hmac-sha256": "calculate_mac_fixed_base64",
    "hkdf-hmac-sha256.v2": "calculate_mac_fixed_base64",
    "hmac-sha256": "calculate_mac_long_kdf",
};

export function createCalculateMAC(olmSAS: Olm.SAS, method: MacMethod) {
    return function (input: string, info: string, log: ILogItem): string {
        return log.wrap({ l: "calculate MAC", method}, () => {
            const mac = olmSAS[macMethods[method]](input, info);
            return mac;
        });
    };
}
