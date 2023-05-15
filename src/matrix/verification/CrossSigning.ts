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

import {verifyEd25519Signature, SignatureVerification} from "../e2ee/common";
import {BaseObservableValue, RetainedObservableValue} from "../../observable/value";
import {pkSign} from "./common";
import {SASVerification} from "./SAS/SASVerification";
import {ToDeviceChannel} from "./SAS/channel/Channel";
import {VerificationEventType} from "./SAS/channel/types";
import {ObservableMap} from "../../observable/map";
import {SASRequest} from "./SAS/SASRequest";
import type {SecretStorage} from "../ssss/SecretStorage";
import type {Storage} from "../storage/idb/Storage";
import type {Platform} from "../../platform/web/Platform";
import type {DeviceTracker} from "../e2ee/DeviceTracker";
import type {HomeServerApi} from "../net/HomeServerApi";
import type {Account} from "../e2ee/Account";
import type {ILogItem} from "../../logging/types";
import type {DeviceMessageHandler} from "../DeviceMessageHandler.js";
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

export enum UserTrust {
    /** We trust the user, the whole signature chain checks out from our MSK to all of their device keys. */
    Trusted = 1,
    /** We haven't signed this user's identity yet. Verify this user first to sign it. */
    UserNotSigned,
    /** We have signed the user already, but the signature isn't valid.
    One possible cause could be that an attacker is uploading signatures in our name. */
    UserSignatureMismatch,
    /** We trust the user, but they don't trust one of their devices. */
    UserDeviceNotSigned,
    /** We trust the user, but the signatures of one of their devices is invalid.
     * One possible cause could be that an attacker is uploading signatures in their name. */
    UserDeviceSignatureMismatch,
    /** The user doesn't have a valid signature for the SSK with their MSK, or the SSK is missing.
     * This likely means bootstrapping cross-signing on their end didn't finish correctly. */
    UserSetupError,
    /** We don't have a valid signature for our SSK with our MSK, the SSK is missing, or we don't trust our own MSK.
     * This likely means bootstrapping cross-signing on our end didn't finish correctly. */
    OwnSetupError
}

enum MSKVerification {
    NoPrivKey,
    NoPubKey,
    DerivedPubKeyMismatch,
    Valid
}

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
    private readonly observedUsers: Map<string, RetainedObservableValue<UserTrust | undefined>> = new Map();
    private readonly deviceId: string;
    private sasVerificationInProgress?: SASVerification;
    public receivedSASVerifications: ObservableMap<string, SASRequest> = new ObservableMap();

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
        this.handleSASDeviceMessage = this.handleSASDeviceMessage.bind(this);
        this.deviceMessageHandler.on("message", this.handleSASDeviceMessage);
    }

    /** @return {boolean} whether cross signing has been enabled on this account */
    async load(log: ILogItem): Promise<boolean> {
        // try to verify the msk without accessing the network
        const verification = await this.verifyMSKFrom4S(false, log);
        return verification !== MSKVerification.NoPrivKey;
    }

    async start(log: ILogItem): Promise<void> {
        if (!this.isMasterKeyTrusted) {
            // try to verify the msk _with_ access to the network
            await this.verifyMSKFrom4S(true, log);
        }
    }

    private async verifyMSKFrom4S(allowNetwork: boolean, log: ILogItem): Promise<MSKVerification> {
        return await log.wrap("CrossSigning.verifyMSKFrom4S", async log => {
            // TODO: use errorboundary here
            const privateMasterKey = await this.getSigningKey(KeyUsage.Master);
            if (!privateMasterKey) {
                log.set("failure", "no_priv_msk");
                return MSKVerification.NoPrivKey;
            }
            const signing = new this.olm.PkSigning();
            let derivedPublicKey;
            try {
                derivedPublicKey = signing.init_with_seed(privateMasterKey);    
            } finally {
                signing.free();
            }
            const publishedMasterKey = await this.deviceTracker.getCrossSigningKeyForUser(this.ownUserId, KeyUsage.Master, allowNetwork ? this.hsApi : undefined, log);
            if (!publishedMasterKey) {
                log.set("failure", "no_pub_msk");
                return MSKVerification.NoPubKey;
            }
            const publisedEd25519Key = publishedMasterKey && getKeyEd25519Key(publishedMasterKey);
            log.set({publishedMasterKey: publisedEd25519Key, derivedPublicKey});
            this._isMasterKeyTrusted = !!publisedEd25519Key && publisedEd25519Key === derivedPublicKey;
            if (!this._isMasterKeyTrusted) {
                log.set("failure", "mismatch");
                return MSKVerification.DerivedPubKeyMismatch;
            }
            return MSKVerification.Valid;
        });
    }

    get isMasterKeyTrusted(): boolean {
        return this._isMasterKeyTrusted;
    }

    startVerification(requestOrUserId: SASRequest, log: ILogItem): SASVerification | undefined;
    startVerification(requestOrUserId: string, log: ILogItem): SASVerification | undefined;
    startVerification(requestOrUserId: string | SASRequest, log: ILogItem): SASVerification | undefined {
        if (this.sasVerificationInProgress && !this.sasVerificationInProgress.finished) {
            return;
        }
        const otherUserId = requestOrUserId instanceof SASRequest ? requestOrUserId.sender : requestOrUserId;
        const startingMessage = requestOrUserId instanceof SASRequest ? requestOrUserId.startingMessage : undefined;
        const channel = new ToDeviceChannel({
            deviceTracker: this.deviceTracker,
            hsApi: this.hsApi,
            otherUserId,
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
            otherUserId,
            log,
            channel,
            e2eeAccount: this.e2eeAccount,
            deviceTracker: this.deviceTracker,
            hsApi: this.hsApi,
            clock: this.platform.clock,
            crossSigning: this,
        });
        return this.sasVerificationInProgress;
    }

    private handleSASDeviceMessage({ unencrypted: event }) {
        const txnId = event.content.transaction_id;
        /**
         * If we receive an event for the current/previously finished 
         * SAS verification, we should ignore it because the device channel
         * object (who also listens for to_device messages) will take care of it (if needed).
         */
        const shouldIgnoreEvent = this.sasVerificationInProgress?.channel.id === txnId;
        if (shouldIgnoreEvent) { return; }
        /**
         * 1. If we receive the cancel message, we need to update the requests map.
         * 2. If we receive an starting message (viz request/start), we need to create the SASRequest from it.
         */
        switch (event.type) {
            case VerificationEventType.Cancel: 
                this.receivedSASVerifications.remove(txnId);
                return;
            case VerificationEventType.Request:
            case VerificationEventType.Start:
                this.platform.logger.run("Create SASRequest", () => {
                    this.receivedSASVerifications.set(txnId, new SASRequest(event));
                });
                return;
            default:
                // we don't care about this event!
                return;
        }
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
            const keyToSign = await this.deviceTracker.deviceForId(this.ownUserId, deviceId, this.hsApi, log);
            if (!keyToSign) {
                return undefined;
            }
            delete keyToSign.signatures;
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
            // can't sign own user
            if (userId === this.ownUserId) {
                return;
            }
            const keyToSign = await this.deviceTracker.getCrossSigningKeyForUser(userId, KeyUsage.Master, this.hsApi, log);
            if (!keyToSign) {
                return;
            }
            const signingKey = await this.getSigningKey(KeyUsage.UserSigning);
            if (!signingKey) {
                return;
            }
            delete keyToSign.signatures;
            // add signature to keyToSign
            this.signKey(keyToSign, signingKey);
            const payload = {
                [keyToSign.user_id]: {
                    [getKeyEd25519Key(keyToSign)!]: keyToSign
                }
            };
            const request = this.hsApi.uploadSignatures(payload, {log});
            await request.response();
            // we don't write the signatures to storage, as we don't want to have too many special
            // cases in the trust algorithm, so instead we just clear the cross signing keys
            // so that they will be refetched when trust is recalculated
            await this.deviceTracker.invalidateUserKeys(userId);
            this.emitUserTrustUpdate(userId, log);
            return keyToSign;
        });
    }

    getUserTrust(userId: string, log: ILogItem): Promise<UserTrust> {
        return log.wrap("CrossSigning.getUserTrust", async log => {
            log.set("id", userId);
            const logResult = (trust: UserTrust): UserTrust => {
                log.set("result", trust);
                return trust;
            };
            if (!this.isMasterKeyTrusted) {
                return logResult(UserTrust.OwnSetupError);
            }
            const ourMSK = await log.wrap("get our msk", log => this.deviceTracker.getCrossSigningKeyForUser(this.ownUserId, KeyUsage.Master, this.hsApi, log));
            if (!ourMSK) {
                return logResult(UserTrust.OwnSetupError);
            }
            const ourUSK = await log.wrap("get our usk", log => this.deviceTracker.getCrossSigningKeyForUser(this.ownUserId, KeyUsage.UserSigning, this.hsApi, log));
            if (!ourUSK) {
                return logResult(UserTrust.OwnSetupError);
            }
            const ourUSKVerification = log.wrap("verify our usk", log => this.hasValidSignatureFrom(ourUSK, ourMSK, log));
            if (ourUSKVerification !== SignatureVerification.Valid) {
                return logResult(UserTrust.OwnSetupError);
            }
            const theirMSK = await log.wrap("get their msk", log => this.deviceTracker.getCrossSigningKeyForUser(userId, KeyUsage.Master, this.hsApi, log));
            if (!theirMSK) {
                /* assume that when they don't have an MSK, they've never enabled cross-signing on their client
                (or it's not supported) rather than assuming a setup error on their side.
                Later on, for their SSK, we _do_ assume it's a setup error as it doesn't make sense to have an MSK without a SSK */
                return logResult(UserTrust.UserNotSigned);
            }
            const theirMSKVerification = log.wrap("verify their msk", log => this.hasValidSignatureFrom(theirMSK, ourUSK, log));
            if (theirMSKVerification !== SignatureVerification.Valid) {
                if (theirMSKVerification === SignatureVerification.NotSigned) {
                    return logResult(UserTrust.UserNotSigned);
                } else { /* SignatureVerification.Invalid */
                    return logResult(UserTrust.UserSignatureMismatch);
                }
            }
            const theirSSK = await log.wrap("get their ssk", log => this.deviceTracker.getCrossSigningKeyForUser(userId, KeyUsage.SelfSigning, this.hsApi, log));
            if (!theirSSK) {
                return logResult(UserTrust.UserSetupError);
            }
            const theirSSKVerification = log.wrap("verify their ssk", log => this.hasValidSignatureFrom(theirSSK, theirMSK, log));
            if (theirSSKVerification !== SignatureVerification.Valid) {
                return logResult(UserTrust.UserSetupError);
            }
            const theirDeviceKeys = await log.wrap("get their devices", log => this.deviceTracker.devicesForUsers([userId], this.hsApi, log));
            const lowestDeviceVerification = theirDeviceKeys.reduce((lowest, dk) => log.wrap({l: "verify device", id: dk.device_id}, log => {
                const verification = this.hasValidSignatureFrom(dk, theirSSK, log);
                    // first Invalid, then NotSigned, then Valid
                    if (lowest === SignatureVerification.Invalid || verification === SignatureVerification.Invalid) {
                        return SignatureVerification.Invalid;
                    } else if (lowest === SignatureVerification.NotSigned || verification === SignatureVerification.NotSigned) {
                        return SignatureVerification.NotSigned;
                    } else if (lowest === SignatureVerification.Valid || verification === SignatureVerification.Valid) {
                        return SignatureVerification.Valid;
                    }
                    // should never happen as we went over all the enum options
                    return SignatureVerification.Invalid;
            }), SignatureVerification.Valid);
            if (lowestDeviceVerification !== SignatureVerification.Valid) {
                if (lowestDeviceVerification === SignatureVerification.NotSigned) {
                    return logResult(UserTrust.UserDeviceNotSigned);
                } else { /* SignatureVerification.Invalid */
                    return logResult(UserTrust.UserDeviceSignatureMismatch);
                }
            }
            return logResult(UserTrust.Trusted);
        });
    }

    dispose(): void {
        this.deviceMessageHandler.off("message", this.handleSASDeviceMessage);
    }

    observeUserTrust(userId: string, log: ILogItem): BaseObservableValue<UserTrust | undefined> {
        const existingValue = this.observedUsers.get(userId);
        if (existingValue) {
            return existingValue;
        }
        const observable = new RetainedObservableValue<UserTrust | undefined>(undefined, () => {
            this.observedUsers.delete(userId);
        });
        this.observedUsers.set(userId, observable);
        log.wrapDetached("get user trust", async log => {
            if (observable.get() === undefined) {
                observable.set(await this.getUserTrust(userId, log));
            }
        });
        return observable;
    }

    private async signDeviceKey(keyToSign: DeviceKey, log: ILogItem): Promise<DeviceKey | undefined> {
        const signingKey = await this.getSigningKey(KeyUsage.SelfSigning);
        if (!signingKey) {
            return undefined;
        }
        // add signature to keyToSign
        this.signKey(keyToSign, signingKey);
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
        // we don't write the signatures to storage, as we don't want to have too many special
        // cases in the trust algorithm, so instead we just clear the device keys
        // so that they will be refetched when trust is recalculated
        await this.deviceTracker.invalidateUserKeys(this.ownUserId);
        this.emitUserTrustUpdate(this.ownUserId, log);
        return keyToSign;
    }

    private async getSigningKey(usage: KeyUsage): Promise<Uint8Array | undefined> {
        const seedStr = await this.secretStorage.readSecret(`m.cross_signing.${usage}`);
        if (seedStr) {
            return new Uint8Array(this.platform.encoding.base64.decode(seedStr));
        }
    }

    private signKey(keyToSign: DeviceKey | CrossSigningKey, signingKey: Uint8Array) {
        pkSign(this.olm, keyToSign, signingKey, this.ownUserId, "");
    }

    private hasValidSignatureFrom(key: DeviceKey | CrossSigningKey, signingKey: CrossSigningKey, log: ILogItem): SignatureVerification {
        const pubKey = getKeyEd25519Key(signingKey);
        if (!pubKey) {
            return SignatureVerification.NotSigned;
        }
        return verifyEd25519Signature(this.olmUtil, signingKey.user_id, pubKey, pubKey, key, log);
    }

    private emitUserTrustUpdate(userId: string, log: ILogItem) {
        const observable = this.observedUsers.get(userId);
        if (observable && observable.get() !== undefined) {
            observable.set(undefined);
            log.wrapDetached("update user trust", async log => {
                observable.set(await this.getUserTrust(userId, log));
            });
        }
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
