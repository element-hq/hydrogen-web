/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {groupByWithCreator} from "../../../utils/groupBy";
import {verifyEd25519Signature, OLM_ALGORITHM} from "../common";
import {createSessionEntry} from "./Session";

import type {OlmMessage, OlmPayload, OlmEncryptedMessageContent} from "./types";
import type {Account} from "../Account";
import type {LockMap} from "../../../utils/LockMap";
import type {Storage} from "../../storage/idb/Storage";
import type {Transaction} from "../../storage/idb/Transaction";
import type {DeviceIdentity} from "../../storage/idb/stores/DeviceIdentityStore";
import type {HomeServerApi} from "../../net/HomeServerApi";
import type {ILogItem} from "../../../logging/types";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

type ClaimedOTKResponse = {
    [userId: string]: {
        [deviceId: string]: {
            [algorithmAndOtk: string]: {
                key: string,
                signatures: {
                    [userId: string]: {
                        [algorithmAndDevice: string]: string
                    }
                }
            }
        }
    }
};

function findFirstSessionId(sessionIds) {
    return sessionIds.reduce((first, sessionId) => {
        if (!first || sessionId < first) {
            return sessionId;
        } else {
            return first;
        }
    }, null);
}

const OTK_ALGORITHM = "signed_curve25519";
// only encrypt this amount of olm messages at once otherwise we run out of wasm memory
// with all the sessions loaded at the same time
// See https://github.com/vector-im/hydrogen-web/issues/150 as well, which indicates the limit is 44,
// but let's take a conservative limit as the megolm session cache also takes space
const MAX_BATCH_SIZE = 20;

export class Encryption {
    constructor(
        private readonly account: Account,
        private readonly pickleKey: string,
        private readonly olm: Olm,
        private readonly storage: Storage,
        private readonly now: () => number,
        private readonly ownUserId: string,
        private readonly olmUtil: Olm.Utility,
        private readonly senderKeyLock: LockMap<string>
    ) {}

    async encrypt(type: string, content: Record<string, any>, devices: DeviceIdentity[], hsApi: HomeServerApi, log: ILogItem): Promise<EncryptedMessage[]> {
        let messages: EncryptedMessage[] = [];
        for (let i = 0; i < devices.length ; i += MAX_BATCH_SIZE) {
            const batchDevices = devices.slice(i, i + MAX_BATCH_SIZE);
            const batchMessages = await this._encryptForMaxDevices(type, content, batchDevices, hsApi, log);
            messages = messages.concat(batchMessages);
        }
        return messages;
    }

    async _encryptForMaxDevices(type: string, content: Record<string, any>, devices: DeviceIdentity[], hsApi: HomeServerApi, log: ILogItem): Promise<EncryptedMessage[]> {
        // TODO: see if we can only hold some of the locks until after the /keys/claim call (if needed)
        // take a lock on all senderKeys so decryption and other calls to encrypt (should not happen)
        // don't modify the sessions at the same time
        const locks = await Promise.all(devices.map(device => {
            return this.senderKeyLock.takeLock(device.curve25519Key);
        }));
        try {
            const {
                devicesWithoutSession,
                existingEncryptionTargets,
            } = await this._findExistingSessions(devices);

            const timestamp = this.now();

            let encryptionTargets: EncryptionTarget[] = [];
            try {
                if (devicesWithoutSession.length) {
                    const newEncryptionTargets = await log.wrap("create sessions", log => this._createNewSessions(
                        devicesWithoutSession, hsApi, timestamp, log));
                    encryptionTargets = encryptionTargets.concat(newEncryptionTargets);
                }
                await this._loadSessions(existingEncryptionTargets);
                encryptionTargets = encryptionTargets.concat(existingEncryptionTargets);
                const encryptLog = {l: "encrypt", targets: encryptionTargets.length};
                const messages = log.wrap(encryptLog, () => encryptionTargets.map(target => {
                    const encryptedContent = this._encryptForDevice(type, content, target);
                    return new EncryptedMessage(encryptedContent, target.device);
                }));
                await this._storeSessions(encryptionTargets, timestamp);
                return messages;
            } finally {
                for (const target of encryptionTargets) {
                    target.dispose();
                }
            }
        } finally {
            for (const lock of locks) {
                lock.release();
            }
        }
    }

    async _findExistingSessions(devices: DeviceIdentity[]): Promise<{devicesWithoutSession: DeviceIdentity[], existingEncryptionTargets: EncryptionTarget[]}> {
        const txn = await this.storage.readTxn([this.storage.storeNames.olmSessions]);
        const sessionIdsForDevice = await Promise.all(devices.map(async device => {
            return await txn.olmSessions.getSessionIds(device.curve25519Key);
        }));
        const devicesWithoutSession = devices.filter((_, i) => {
            const sessionIds = sessionIdsForDevice[i];
            return !(sessionIds?.length);
        });

        const existingEncryptionTargets = devices.map((device, i) => {
            const sessionIds = sessionIdsForDevice[i];
            if (sessionIds?.length > 0) {
                const sessionId = findFirstSessionId(sessionIds);
                return EncryptionTarget.fromSessionId(device, sessionId);
            }
        }).filter(target => !!target) as EncryptionTarget[];

        return {devicesWithoutSession, existingEncryptionTargets};
    }

    _encryptForDevice(type: string, content: Record<string, any>, target: EncryptionTarget): OlmEncryptedMessageContent {
        const {session, device} = target;
        const plaintext = JSON.stringify(this._buildPlainTextMessageForDevice(type, content, device));
        const message = session!.encrypt(plaintext);
        const encryptedContent = {
            algorithm: OLM_ALGORITHM,
            sender_key: this.account.identityKeys.curve25519,
            ciphertext: {
                [device.curve25519Key]: message
            }
        };
        return encryptedContent;
    }

    _buildPlainTextMessageForDevice(type: string, content: Record<string, any>, device: DeviceIdentity): OlmPayload {
        return {
            keys: {
                "ed25519": this.account.identityKeys.ed25519
            },
            recipient_keys: {
                "ed25519": device.ed25519Key
            },
            recipient: device.userId,
            sender: this.ownUserId,
            content,
            type
        };
    }

    async _createNewSessions(devicesWithoutSession: DeviceIdentity[], hsApi: HomeServerApi, timestamp: number, log: ILogItem): Promise<EncryptionTarget[]> {
        const newEncryptionTargets = await log.wrap("claim", log => this._claimOneTimeKeys(hsApi, devicesWithoutSession, log));
        try {
            for (const target of newEncryptionTargets) {
                const {device, oneTimeKey} = target;
                target.session = await this.account.createOutboundOlmSession(device.curve25519Key, oneTimeKey);
            }
            await this._storeSessions(newEncryptionTargets, timestamp);
        } catch (err) {
            for (const target of newEncryptionTargets) {
                target.dispose();
            }
            throw err;
        }
        return newEncryptionTargets;
    }

    async _claimOneTimeKeys(hsApi: HomeServerApi, deviceIdentities: DeviceIdentity[], log: ILogItem): Promise<EncryptionTarget[]> {
        // create a Map<userId, Map<deviceId, deviceIdentity>>
        const devicesByUser = groupByWithCreator(deviceIdentities,
            (device: DeviceIdentity) => device.userId,
            (): Map<string, DeviceIdentity> => new Map(),
            (deviceMap: Map<string, DeviceIdentity>, device: DeviceIdentity) => deviceMap.set(device.deviceId, device)
        );
        const oneTimeKeys = Array.from(devicesByUser.entries()).reduce((usersObj, [userId, deviceMap]) => {
            usersObj[userId] = Array.from(deviceMap.values()).reduce((devicesObj, device) => {
                devicesObj[device.deviceId] = OTK_ALGORITHM;
                return devicesObj;
            }, {});
            return usersObj;
        }, {});
        const claimResponse = await hsApi.claimKeys({
            timeout: 10000,
            one_time_keys: oneTimeKeys
        }, {log}).response();
        if (Object.keys(claimResponse.failures).length) {
            log.log({l: "failures", servers: Object.keys(claimResponse.failures)}, log.level.Warn);
        }
        const userKeyMap = claimResponse?.["one_time_keys"] as ClaimedOTKResponse;
        return this._verifyAndCreateOTKTargets(userKeyMap, devicesByUser, log);
    }

    _verifyAndCreateOTKTargets(userKeyMap: ClaimedOTKResponse, devicesByUser: Map<string, Map<string, DeviceIdentity>>, log: ILogItem): EncryptionTarget[] {
        const verifiedEncryptionTargets: EncryptionTarget[] = [];
        for (const [userId, userSection] of Object.entries(userKeyMap)) {
            for (const [deviceId, deviceSection] of Object.entries(userSection)) {
                const [firstPropName, keySection] = Object.entries(deviceSection)[0];
                const [keyAlgorithm] = firstPropName.split(":");
                if (keyAlgorithm === OTK_ALGORITHM) {
                    const device = devicesByUser.get(userId)?.get(deviceId);
                    if (device) {
                        const isValidSignature = verifyEd25519Signature(
                            this.olmUtil, userId, deviceId, device.ed25519Key, keySection, log);
                        if (isValidSignature) {
                            const target = EncryptionTarget.fromOTK(device, keySection.key);
                            verifiedEncryptionTargets.push(target);
                        }
                    }
                }
            }
        }
        return verifiedEncryptionTargets;
    }

    async _loadSessions(encryptionTargets: EncryptionTarget[]): Promise<void> {
        const txn = await this.storage.readTxn([this.storage.storeNames.olmSessions]);
        // given we run loading in parallel, there might still be some
        // storage requests that will finish later once one has failed.
        // those should not allocate a session anymore.
        let failed = false;
        try {
            await Promise.all(encryptionTargets.map(async encryptionTarget => {
                const sessionEntry = await txn.olmSessions.get(
                    encryptionTarget.device.curve25519Key, encryptionTarget.sessionId!);
                if (sessionEntry && !failed) {
                    const olmSession = new this.olm.Session();
                    olmSession.unpickle(this.pickleKey, sessionEntry.session);
                    encryptionTarget.session = olmSession;
                }
            }));
        } catch (err) {
            failed = true;
            // clean up the sessions that did load
            for (const target of encryptionTargets) {
                target.dispose();
            }
            throw err;
        }
    }

    async _storeSessions(encryptionTargets: EncryptionTarget[], timestamp: number): Promise<void> {
        const txn = await this.storage.readWriteTxn([this.storage.storeNames.olmSessions]);
        try {
            for (const target of encryptionTargets) {
                const sessionEntry = createSessionEntry(
                    target.session!, target.device.curve25519Key, timestamp, this.pickleKey);
                txn.olmSessions.set(sessionEntry);
            }
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
    }
}

// just a container needed to encrypt a message for a recipient device
// it is constructed with either a oneTimeKey
// (and later converted to a session) in case of a new session
// or an existing session
class EncryptionTarget {

    public session: Olm.Session | null = null;

    constructor(
        public readonly device: DeviceIdentity,
        public readonly oneTimeKey: string | null,
        public readonly sessionId: string | null
    ) {}

    static fromOTK(device: DeviceIdentity, oneTimeKey: string): EncryptionTarget {
        return new EncryptionTarget(device, oneTimeKey, null);
    }

    static fromSessionId(device: DeviceIdentity, sessionId: string): EncryptionTarget {
        return new EncryptionTarget(device, null, sessionId);
    }

    dispose(): void {
        if (this.session) {
            this.session.free();
        }
    }
}

class EncryptedMessage {
    constructor(
        public readonly content: OlmEncryptedMessageContent,
        public readonly device: DeviceIdentity
    ) {}
}
