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
import {ILogItem} from "../../lib";
import {pkSign} from "./common";
import type {ISignatures} from "./common";
import {SASVerification} from "./SAS/SASVerification";
import {ToDeviceChannel} from "./SAS/channel/Channel";
import type {DeviceMessageHandler} from "../DeviceMessageHandler.js";
import {VerificationEventType} from "./SAS/channel/types";

type Olm = typeof OlmNamespace;

export class CrossSigning {
    private readonly storage: Storage;
    private readonly secretStorage: SecretStorage;
    private readonly platform: Platform;
    private readonly deviceTracker: DeviceTracker;
    private readonly olm: Olm;
    private readonly olmUtil: Olm.Utility;
    private readonly hsApi: HomeServerApi;
    private readonly ownUserId: string;
    private readonly e2eeAccount: Account;
    private readonly deviceMessageHandler: DeviceMessageHandler;
    private _isMasterKeyTrusted: boolean = false;
    private readonly deviceId: string;
    private sasVerificationInProgress?: SASVerification;

    constructor(options: {
        storage: Storage,
        secretStorage: SecretStorage,
        deviceTracker: DeviceTracker,
        platform: Platform,
        olm: Olm,
        olmUtil: Olm.Utility,
        ownUserId: string,
        deviceId: string,
        hsApi: HomeServerApi,
        e2eeAccount: Account,
        deviceMessageHandler: DeviceMessageHandler,
    }) {
        this.storage = options.storage;
        this.secretStorage = options.secretStorage;
        this.platform = options.platform;
        this.deviceTracker = options.deviceTracker;
        this.olm = options.olm;
        this.olmUtil = options.olmUtil;
        this.hsApi = options.hsApi;
        this.ownUserId = options.ownUserId;
        this.deviceId = options.deviceId;
        this.e2eeAccount = options.e2eeAccount
        this.deviceMessageHandler = options.deviceMessageHandler;

        this.deviceMessageHandler.on("message", async ({ unencrypted: unencryptedEvent }) => {
            if (this.sasVerificationInProgress &&
                (
                    !this.sasVerificationInProgress.finished ||
                    // If the start message is for the previous sasverification, ignore it.
                    this.sasVerificationInProgress.channel.id === unencryptedEvent.content.transaction_id
                )) {
                return;
            }
            if (unencryptedEvent.type === VerificationEventType.Request ||
                unencryptedEvent.type === VerificationEventType.Start) {
                await this.platform.logger.run("Start verification from request", async (log) => {
                    const sas = this.startVerification(unencryptedEvent.sender, unencryptedEvent, log);
                    await sas?.start();
                });
            }
        })
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
            const publishedKeys = await this.deviceTracker.getCrossSigningKeysForUser(this.ownUserId, this.hsApi, log);
            log.set({publishedMasterKey: publishedKeys.masterKey, derivedPublicKey});
            this._isMasterKeyTrusted = publishedKeys.masterKey === derivedPublicKey;
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
            const signedDeviceKey = await this.signDevice(deviceKey);
            const payload = {
                [signedDeviceKey["user_id"]]: {
                    [signedDeviceKey["device_id"]]: signedDeviceKey
                }
            };
            const request = this.hsApi.uploadSignatures(payload, {log});
            await request.response();
        });
    }

    private async signDevice<T extends object>(data: T): Promise<T & { signatures: ISignatures }> {
        const txn = await this.storage.readTxn([this.storage.storeNames.accountData]);
        const seedStr = await this.secretStorage.readSecret(`m.cross_signing.self_signing`, txn);
        const seed = new Uint8Array(this.platform.encoding.base64.decode(seedStr));
        pkSign(this.olm, data, seed, this.ownUserId, "");
        return data as T & { signatures: ISignatures };
    }

    get isMasterKeyTrusted(): boolean {
        return this._isMasterKeyTrusted;
    }

    startVerification(userId: string, startingMessage: any, log: ILogItem): SASVerification | undefined {
        if (this.sasVerificationInProgress && !this.sasVerificationInProgress.finished) {
            return;
        }
        const channel = new ToDeviceChannel({
            deviceTracker: this.deviceTracker,
            hsApi: this.hsApi,
            otherUserId: userId,
            clock: this.platform.clock,
            deviceMessageHandler: this.deviceMessageHandler,
            ourUserDeviceId: this.deviceId,
            log
        }, startingMessage);

        this.sasVerificationInProgress = new SASVerification({
            olm: this.olm,
            olmUtil: this.olmUtil,
            ourUserId: this.ownUserId,
            ourUserDeviceId: this.deviceId,
            otherUserId: userId,
            log,
            channel,
            e2eeAccount: this.e2eeAccount,
            deviceTracker: this.deviceTracker,
            hsApi: this.hsApi,
            clock: this.platform.clock,
        });
        return this.sasVerificationInProgress;
    }
}


