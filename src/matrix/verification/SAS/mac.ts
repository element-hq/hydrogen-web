/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
