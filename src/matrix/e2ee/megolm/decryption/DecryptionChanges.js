/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {DecryptionError} from "../../common";

export class DecryptionChanges {
    constructor(roomId, results, errors, replayEntries) {
        this._roomId = roomId;
        this._results = results;
        this._errors = errors;
        this._replayEntries = replayEntries;
    }

    /**
     * @type MegolmBatchDecryptionResult
     * @property {Map<string, DecryptionResult>} results a map of event id to decryption result
     * @property {Map<string, Error>} errors event id -> errors
     * 
     * Handle replay attack detection, and return result
     * @param  {[type]} txn [description]
     * @return {MegolmBatchDecryptionResult}
     */
    async write(txn) {
        await Promise.all(this._replayEntries.map(async replayEntry => {
            try {
                this._handleReplayAttack(this._roomId, replayEntry, txn);
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
    async _handleReplayAttack(roomId, replayEntry, txn) {
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
