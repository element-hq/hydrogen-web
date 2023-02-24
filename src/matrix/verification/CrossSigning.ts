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

import type {SecretStorage} from "../ssss/SecretStorage";
import type {Storage} from "../storage/idb/Storage";
import type {Platform} from "../../platform/web/Platform";
import type {DeviceTracker} from "../e2ee/DeviceTracker";
import type * as OlmNamespace from "@matrix-org/olm";
import type {HomeServerApi} from "../net/HomeServerApi";
import type {Account} from "../e2ee/Account";
import { ILogItem } from "../../lib";
import {pkSign} from "./common";
import type {ISignatures} from "./common";

type Olm = typeof OlmNamespace;

export enum KeyUsage {
    Master = "master",
    SelfSigning = "self_signing",
    UserSigning = "user_signing"
};

export class CrossSigning {
    private readonly storage: Storage;
    private readonly secretStorage: SecretStorage;
    private readonly platform: Platform;
    private readonly deviceTracker: DeviceTracker;
    private readonly olm: Olm;
    private readonly hsApi: HomeServerApi;
    private readonly ownUserId: string;
    private readonly e2eeAccount: Account;
    private _isMasterKeyTrusted: boolean = false;

    constructor(options: {
        storage: Storage,
        secretStorage: SecretStorage,
        deviceTracker: DeviceTracker,
        platform: Platform,
        olm: Olm,
        ownUserId: string,
        hsApi: HomeServerApi,
        e2eeAccount: Account
    }) {
        this.storage = options.storage;
        this.secretStorage = options.secretStorage;
        this.platform = options.platform;
        this.deviceTracker = options.deviceTracker;
        this.olm = options.olm;
        this.hsApi = options.hsApi;
        this.ownUserId = options.ownUserId;
        this.e2eeAccount = options.e2eeAccount
    }

    async init(log: ILogItem) {
        log.wrap("CrossSigning.init", async log => {
            // TODO: use errorboundary here
            const txn = await this.storage.readTxn([this.storage.storeNames.accountData]);
            
            const mskSeed = await this.secretStorage.readSecret("m.cross_signing.master", txn);
            const signing = new this.olm.PkSigning();
            let derivedPublicKey;
            try {
                const seed = new Uint8Array(this.platform.encoding.base64.decode(mskSeed));
                derivedPublicKey = signing.init_with_seed(seed);    
            } finally {
                signing.free();
            }
            const masterKey = await this.deviceTracker.getCrossSigningKeyForUser(this.ownUserId, KeyUsage.Master, this.hsApi, log);
            log.set({publishedMasterKey: masterKey, derivedPublicKey});
            this._isMasterKeyTrusted = masterKey === derivedPublicKey;
            log.set("isMasterKeyTrusted", this.isMasterKeyTrusted);
        });
    }

    async signOwnDevice(log: ILogItem) {
        log.wrap("CrossSigning.signOwnDevice", async log => {
            if (!this._isMasterKeyTrusted) {
                log.set("mskNotTrusted", true);
                return;
            }
            const deviceKey = this.e2eeAccount.getDeviceKeysToSignWithCrossSigning();
            const signedDeviceKey = await this.signDeviceData(deviceKey);
            const payload = {
                [signedDeviceKey["user_id"]]: {
                    [signedDeviceKey["device_id"]]: signedDeviceKey
                }
            };
            const request = this.hsApi.uploadSignatures(payload, {log});
            await request.response();
        });
    }

    signDevice(deviceId: string) {
        // need to get the device key for the device
    }

    signUser(userId: string) {
        // need to be able to get the msk for the user
    }

    private async signDeviceData<T extends object>(data: T): Promise<T & { signatures: ISignatures }> {
        const txn = await this.storage.readTxn([this.storage.storeNames.accountData]);
        const seedStr = await this.secretStorage.readSecret(`m.cross_signing.self_signing`, txn);
        const seed = new Uint8Array(this.platform.encoding.base64.decode(seedStr));
        pkSign(this.olm, data, seed, this.ownUserId, "");
        return data as T & { signatures: ISignatures };
    }

    get isMasterKeyTrusted(): boolean {
        return this._isMasterKeyTrusted;
    }
}

export function getKeyUsage(keyInfo): KeyUsage | undefined {
    if (!Array.isArray(keyInfo.usage) || keyInfo.usage.length !== 1) {
        return undefined;
    }
    const usage = keyInfo.usage[0];
    if (usage !== KeyUsage.Master && usage !== KeyUsage.SelfSigning && usage !== KeyUsage.UserSigning) {
        return undefined;
    }
    return usage;
}

const algorithm = "ed25519";
const prefix = `${algorithm}:`;

export function getKeyEd25519Key(keyInfo): string | undefined {
    const ed25519KeyIds = Object.keys(keyInfo.keys).filter(keyId => keyId.startsWith(prefix));
    if (ed25519KeyIds.length !== 1) {
        return undefined;
    }
    const keyId = ed25519KeyIds[0];
    const publicKey = keyInfo.keys[keyId];
    return publicKey;
}

export function getKeyUserId(keyInfo): string | undefined {
    return keyInfo["user_id"];
}
