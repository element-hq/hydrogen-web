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

import {DecryptionResult} from "../../DecryptionResult.js";
import {DecryptionError} from "../../common.js";
import {ReplayDetectionEntry} from "./ReplayDetectionEntry.js";

/**
 * Does the actual decryption of all events for a given megolm session in a batch
 */
export class SessionDecryption {
    constructor(sessionInfo, events, decryptor) {
        sessionInfo.retain();
        this._sessionInfo = sessionInfo;
        this._events = events;
        this._decryptor = decryptor;
    }

    async decryptAll() {
        const replayEntries = [];
        const results = new Map();
        let errors;
        const roomId = this._sessionInfo.roomId;

        await Promise.all(this._events.map(async event => {
            try {
                const {session} = this._sessionInfo;
                const ciphertext = event.content.ciphertext;
                const {plaintext, message_index: messageIndex} = await this._decryptor.decrypt(session, ciphertext);
                let payload;
                try {
                    payload = JSON.parse(plaintext);
                } catch (err) {
                    throw new DecryptionError("PLAINTEXT_NOT_JSON", event, {plaintext, err});
                }
                if (payload.room_id !== roomId) {
                    throw new DecryptionError("MEGOLM_WRONG_ROOM", event,
                        {encryptedRoomId: payload.room_id, eventRoomId: roomId});
                }
                replayEntries.push(new ReplayDetectionEntry(session.session_id(), messageIndex, event));
                const result = new DecryptionResult(payload, this._sessionInfo.senderKey, this._sessionInfo.claimedKeys);
                results.set(event.event_id, result);
            } catch (err) {
                if (!errors) {
                    errors = new Map();
                }
                errors.set(event.event_id, err);
            }
        }));

        return {results, errors, replayEntries};
    }

    dispose() {
        this._sessionInfo.release();
    }
}
