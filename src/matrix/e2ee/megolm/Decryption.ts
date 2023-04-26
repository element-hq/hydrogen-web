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

import {DecryptionPreparation} from "./decryption/DecryptionPreparation.js";
import {SessionDecryption} from "./decryption/SessionDecryption";
import {DecryptionError, MEGOLM_ALGORITHM} from "../common";
import {validateEvent, groupEventsBySession} from "./decryption/utils";
import {keyFromStorage, keyFromDeviceMessage, keyFromBackup} from "./decryption/RoomKey";
import type {RoomKey, IncomingRoomKey} from "./decryption/RoomKey";
import type {KeyLoader} from "./decryption/KeyLoader";
import type {OlmWorker} from "../OlmWorker";
import type {Transaction} from "../../storage/idb/Transaction";
import type {TimelineEvent} from "../../storage/types";
import type {DecryptionResult} from "../DecryptionResult";
import type {ILogItem} from "../../../logging/types";

export class Decryption {
    private keyLoader: KeyLoader;
    private olmWorker?: OlmWorker;

    constructor(keyLoader: KeyLoader, olmWorker: OlmWorker | undefined) {
        this.keyLoader = keyLoader;
        this.olmWorker = olmWorker;
    }

    async addMissingKeyEventIds(roomId, senderKey, sessionId, eventIds, txn) {
        let sessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
        // we never want to overwrite an existing key
        if (sessionEntry?.session) {
            return;
        }
        if (sessionEntry) {
            const uniqueEventIds = new Set(sessionEntry.eventIds);
            for (const id of eventIds) {
                uniqueEventIds.add(id);
            }
            sessionEntry.eventIds = Array.from(uniqueEventIds);
        } else {
            sessionEntry = {roomId, senderKey, sessionId, eventIds};
        }
        txn.inboundGroupSessions.set(sessionEntry);
    }

    async getEventIdsForMissingKey(roomId, senderKey, sessionId, txn) {
        const sessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
        if (sessionEntry && !sessionEntry.session) {
            return sessionEntry.eventIds;
        }
    }

    async hasSession(roomId, senderKey, sessionId, txn) {
        const sessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
        const isValidSession = typeof sessionEntry?.session === "string";
        return isValidSession;
    }

    /**
     * Reads all the state from storage to be able to decrypt the given events.
     * Decryption can then happen outside of a storage transaction.
     * @param  {[type]} roomId       [description]
     * @param  {[type]} events       [description]
     * @param  {RoomKey[]?} newKeys  keys as returned from extractRoomKeys, but not yet committed to storage. May be undefined.
     * @param  {[type]} sessionCache [description]
     * @param  {[type]} txn          [description]
     * @return {DecryptionPreparation}
     */
    async prepareDecryptAll(roomId: string, events: TimelineEvent[], newKeys: IncomingRoomKey[] | undefined, txn: Transaction) {
        const errors = new Map();
        const validEvents: TimelineEvent[] = [];

        for (const event of events) {
            if (validateEvent(event)) {
                validEvents.push(event);
            } else {
                errors.set(event.event_id, new DecryptionError("MEGOLM_INVALID_EVENT", event))
            }
        }

        const eventsBySession = groupEventsBySession(validEvents);

        const sessionDecryptions: SessionDecryption[] = [];
        await Promise.all(Array.from(eventsBySession.values()).map(async group => {
            const key = await this.getRoomKey(roomId, group.senderKey!, group.sessionId!, newKeys, txn);
            if (key) {
                sessionDecryptions.push(new SessionDecryption(key, group.events, this.olmWorker, this.keyLoader));
            } else {
                for (const event of group.events) {
                    errors.set(event.event_id, new DecryptionError("MEGOLM_NO_SESSION", event));
                }
            }
        }));

        return new DecryptionPreparation(roomId, sessionDecryptions, errors);
    }

    private async getRoomKey(roomId: string, senderKey: string, sessionId: string, newKeys: IncomingRoomKey[] | undefined, txn: Transaction): Promise<RoomKey | undefined> {
        if (newKeys) {
            const key = newKeys.find(k => k.isForSession(roomId, senderKey, sessionId));
            if (key && await key.checkBetterThanKeyInStorage(this.keyLoader, txn)) {
                return key;
            }
        }
        // look only in the cache after looking into newKeys as it may contains that are better
        const cachedKey = this.keyLoader.getCachedKey(roomId, senderKey, sessionId);
        if (cachedKey) {
            return cachedKey;
        }
        const storageKey = await keyFromStorage(roomId, senderKey, sessionId, txn);
        if (storageKey && storageKey.serializationKey) {
            return storageKey;
        }
    }

    /**
     * Writes the key as an inbound group session if there is not already a better key in the store
     */
    writeRoomKey(key: IncomingRoomKey, txn: Transaction): Promise<boolean> {
        return key.write(this.keyLoader, txn);
    }

    /**
     * Extracts room keys from decrypted device messages.
     * The key won't be persisted yet, you need to call RoomKey.write for that.
     */
    roomKeysFromDeviceMessages(decryptionResults: DecryptionResult[], log: ILogItem): IncomingRoomKey[] {
        const keys: IncomingRoomKey[] = [];
        for (const dr of decryptionResults) {
            if (dr.event?.type !== "m.room_key" || dr.event.content?.algorithm !== MEGOLM_ALGORITHM) {
                continue;
            }
            log.wrap("room_key", log => {
                const key = keyFromDeviceMessage(dr);
                if (key) {
                    log.set("roomId", key.roomId);
                    log.set("id", key.sessionId);
                    keys.push(key);
                } else {
                    log.logLevel = log.level.Warn;
                    log.set("invalid", true);
                }
            }, log.level.Detail);
        }
        return keys;
    }

    roomKeyFromBackup(roomId: string, sessionId: string, sessionInfo: string): IncomingRoomKey | undefined {
        return keyFromBackup(roomId, sessionId, sessionInfo);
    }

    dispose() {
        this.keyLoader.dispose();
    }
}
