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

import {DecryptionError} from "../../common";
import type {DecryptionResult} from "../../DecryptionResult";
import type {ReplayDetectionEntry} from "./ReplayDetectionEntry";
import type {Transaction} from "../../../storage/idb/Transaction";


export class DecryptionChanges {
    private _roomId: string;
    private _results: Map<string, DecryptionResult>;
    private _errors: Map<string, DecryptionError>;
    private _replayEntries: ReplayDetectionEntry[];

    constructor(roomId: string, results: Map<string, DecryptionResult>, errors: Map<string, DecryptionError>, replayEntries: ReplayDetectionEntry[]) {
        this._roomId = roomId;
        this._results = results;
        this._errors = errors;
        this._replayEntries = replayEntries;
    }

    /**
     * Handle replay attack detection, and return result
     */
    async write(txn: Transaction): Promise<MegolmBatchDecryptionResult> {
        await Promise.all(this._replayEntries.map(async replayEntry => {
            try {
                void this._handleReplayAttack(this._roomId, replayEntry, txn);
            } catch (err) {
                this._errors.set(replayEntry.eventId, err);
            }
        }));
        return {
            results: this._results,
            errors: this._errors
        };
    }

    // need to handle replay attack because
    // if we redecrypted the same message twice and showed it again
    // then it could be a malicious server admin replaying the word “yes”
    // to make you respond to a msg you didn’t say “yes” to, or something
    async _handleReplayAttack(roomId: string, replayEntry: ReplayDetectionEntry, txn: Transaction): Promise<void> {
        const {messageIndex, sessionId, eventId, timestamp} = replayEntry;
        const decryption = await txn.groupSessionDecryptions.get(roomId, sessionId, messageIndex);

        if (decryption && decryption.eventId !== eventId) {
            // the one with the newest timestamp should be the attack
            const decryptedEventIsBad = decryption.timestamp < timestamp;
            const badEventId = decryptedEventIsBad ? eventId : decryption.eventId;
            // discard result
            this._results.delete(eventId);

            throw new DecryptionError("MEGOLM_REPLAYED_INDEX", event, {
                messageIndex,
                badEventId,
                otherEventId: decryption.eventId
            });
        }

        if (!decryption) {
            txn.groupSessionDecryptions.set(roomId, sessionId, messageIndex, {
                eventId,
                timestamp
            });
        }
    }
}

type MegolmBatchDecryptionResult = {
    // a map of event id to decryption result
    results: Map<string, DecryptionResult>;
    // event id -> errors
    errors: Map<string, DecryptionError>;
};