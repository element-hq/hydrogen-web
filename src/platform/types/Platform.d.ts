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

import type {BaseLogger} from "../../logging/BaseLogger";
import type {SettingsStorage} from "../web/dom/SettingsStorage.js";
import type {Clock} from "../web/dom/Clock.js";
import type {History} from "../web/dom/History.js";
import type {OnlineStatus} from "../web/dom/OnlineStatus.js";
import type {Encoding} from "../web/utils/Encoding.js";

export interface IPlatformConfig {
    worker: string;
    downloadSandbox: string;
    defaultHomeServer: string;
    serviceWorker?: string;
    olm: {
        wasm: string;
        legacyBundle: string;
        wasmBundle: string;
    }
}

export interface IPlatformOptions {
    development?: boolean;
}

export interface CryptoExtras {
    aesjs?: any;
    hkdf?: any;
}

export interface IPlatform {
    readonly logger: BaseLogger;
    readonly settingsStorage: SettingsStorage;
    readonly clock: Clock;
    readonly encoding: Encoding;
    readonly random: () => number;
    readonly history: History;
    readonly onlineStatus: OnlineStatus;
}
