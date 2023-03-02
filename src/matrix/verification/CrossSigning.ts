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

import { ILogItem } from "../../lib";
import {pkSign} from "./common";

import type {SecretStorage} from "../ssss/SecretStorage";
import type {Storage} from "../storage/idb/Storage";
import type {Platform} from "../../platform/web/Platform";
import type {DeviceTracker} from "../e2ee/DeviceTracker";
import type {HomeServerApi} from "../net/HomeServerApi";
import type {Account} from "../e2ee/Account";
import type {SignedValue, DeviceKey} from "../e2ee/common";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

// we store cross-signing (and device) keys in the format we get them from the server
// as that is what the signature is calculated on, so to verify and sign, we need
// it in this format anyway.
export type CrossSigningKey = SignedValue & {
    readonly user_id: string;
    readonly usage: ReadonlyArray<string>;
    readonly keys: {[keyId: string]: string};
}

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
            const privateMasterKey = await this.getSigningKey(KeyUsage.Master);
            const signing = new this.olm.PkSigning();
            let derivedPublicKey;
            try {
                derivedPublicKey = signing.init_with_seed(privateMasterKey);    
            } finally {
                signing.free();
            }
            const publishedMasterKey = await this.deviceTracker.getCrossSigningKeyForUser(this.ownUserId, KeyUsage.Master, this.hsApi, log);
            const publisedEd25519Key = publishedMasterKey && getKeyEd25519Key(publishedMasterKey);
            log.set({publishedMasterKey: publisedEd25519Key, derivedPublicKey});
            this._isMasterKeyTrusted = !!publisedEd25519Key && publisedEd25519Key === derivedPublicKey;
            log.set("isMasterKeyTrusted", this.isMasterKeyTrusted);
        });
    }

    get isMasterKeyTrusted(): boolean {
        return this._isMasterKeyTrusted;
    }

    /** returns our own device key signed by our self-signing key. Other signatures will be missing. */
    async signOwnDevice(log: ILogItem): Promise<DeviceKey | undefined> {
        return log.wrap("CrossSigning.signOwnDevice", async log => {
            if (!this._isMasterKeyTrusted) {
                log.set("mskNotTrusted", true);
                return;
            }
            const ownDeviceKey = this.e2eeAccount.getUnsignedDeviceKey() as DeviceKey;
            return this.signDeviceKey(ownDeviceKey, log);
        });
    }

    /** @return the signed device key for the given device id */
    async signDevice(deviceId: string, log: ILogItem): Promise<DeviceKey | undefined> {
        return log.wrap("CrossSigning.signDevice", async log => {
            log.set("id", deviceId);
            if (!this._isMasterKeyTrusted) {
                log.set("mskNotTrusted", true);
                return;
            }
            // need to be able to get the msk for the user
            const keyToSign = await this.deviceTracker.deviceForId(this.ownUserId, deviceId, this.hsApi, log);
            if (!keyToSign) {
                return undefined;
            }
            return this.signDeviceKey(keyToSign, log);
        });
    }

    /** @return the signed MSK for the given user id */
    async signUser(userId: string, log: ILogItem): Promise<CrossSigningKey | undefined> {
        return log.wrap("CrossSigning.signUser", async log => {
            log.set("id", userId);
            if (!this._isMasterKeyTrusted) {
                log.set("mskNotTrusted", true);
                return;
            }
            // need to be able to get the msk for the user
            // can't sign own user
            if (userId === this.ownUserId) {
                return;
            }
            const keyToSign = await this.deviceTracker.getCrossSigningKeyForUser(userId, KeyUsage.Master, this.hsApi, log);
            if (!keyToSign) {
                return undefined;
            }
            const signingKey = await this.getSigningKey(KeyUsage.UserSigning);
            // add signature to keyToSign
            pkSign(this.olm, keyToSign, signingKey, this.ownUserId, "");
            const payload = {
                [keyToSign.user_id]: {
                    [getKeyEd25519Key(keyToSign)!]: keyToSign
                }
            };
            const request = this.hsApi.uploadSignatures(payload, {log});
            await request.response();
            return keyToSign;
        });
    }

    private async signDeviceKey(keyToSign: DeviceKey, log: ILogItem): Promise<DeviceKey> {
        const signingKey = await this.getSigningKey(KeyUsage.SelfSigning);
        // add signature to keyToSign
        pkSign(this.olm, keyToSign, signingKey, this.ownUserId, "");
        // so the payload format of a signature is a map from userid to key id of the signed key
        // (without the algoritm prefix though according to example, e.g. just device id or base 64 public key)
        // to the complete signed key with the signature of the signing key in the signatures section.
        const payload = {
            [keyToSign.user_id]: {
                [keyToSign.device_id]: keyToSign
            }
        };
        const request = this.hsApi.uploadSignatures(payload, {log});
        await request.response();
        return keyToSign;
    }

    private async getSigningKey(usage: KeyUsage): Promise<Uint8Array> {
        const txn = await this.storage.readTxn([this.storage.storeNames.accountData]);
        const seedStr = await this.secretStorage.readSecret(`m.cross_signing.${usage}`, txn);
        const seed = new Uint8Array(this.platform.encoding.base64.decode(seedStr));
        return seed;
    }
}

export function getKeyUsage(keyInfo: CrossSigningKey): KeyUsage | undefined {
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

export function getKeyEd25519Key(keyInfo: CrossSigningKey): string | undefined {
    const ed25519KeyIds = Object.keys(keyInfo.keys).filter(keyId => keyId.startsWith(prefix));
    if (ed25519KeyIds.length !== 1) {
        return undefined;
    }
    const keyId = ed25519KeyIds[0];
    const publicKey = keyInfo.keys[keyId];
    return publicKey;
}

export function getKeyUserId(keyInfo: CrossSigningKey): string | undefined {
    return keyInfo["user_id"];
}
