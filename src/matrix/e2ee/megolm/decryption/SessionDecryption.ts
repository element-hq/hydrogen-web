/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {DecryptionResult} from "../../DecryptionResult";
import {DecryptionError} from "../../common";
import {ReplayDetectionEntry} from "./ReplayDetectionEntry";
import type {RoomKey} from "./RoomKey";
import type {KeyLoader, OlmDecryptionResult} from "./KeyLoader";
import type {OlmWorker} from "../../OlmWorker";
import type {TimelineEvent} from "../../../storage/types";

interface DecryptAllResult {
    readonly results: Map<string, DecryptionResult>;
    readonly errors?: Map<string, Error>;
    readonly replayEntries: ReplayDetectionEntry[];
}
/**
 * Does the actual decryption of all events for a given megolm session in a batch
 */
export class SessionDecryption {
    private decryptionRequests?: any[];

    constructor(
        private readonly key: RoomKey,
        private readonly events: TimelineEvent[],
        private readonly olmWorker: OlmWorker | undefined,
        private readonly keyLoader: KeyLoader
    ) {
        this.decryptionRequests = olmWorker ? [] : undefined;
    }

    async decryptAll(): Promise<DecryptAllResult> {
        const replayEntries: ReplayDetectionEntry[] = [];
        const results: Map<string, DecryptionResult> = new Map();
        let errors: Map<string, Error> | undefined;

        await this.keyLoader.useKey(this.key, async session => {
            for (const event of this.events) {
                try {
                    const ciphertext = event.content.ciphertext as string;
                    let decryptionResult: OlmDecryptionResult | undefined;
                    // TODO: pass all cipthertexts in one go to the megolm worker and don't deserialize the key until in the worker?
                    if (this.olmWorker) {
                        const request = this.olmWorker.megolmDecrypt(session, ciphertext);
                        this.decryptionRequests!.push(request);
                        decryptionResult = await request.response();
                    } else {
                        // the return type of Olm.InboundGroupSession::decrypt is likely wrong, message_index is a number and not a string AFAIK
                        // getting it fixed upstream but fixing it like this for now.
                        decryptionResult = session.decrypt(ciphertext) as unknown as OlmDecryptionResult;
                    }
                    const {plaintext} = decryptionResult!;
                    let payload;
                    try {
                        payload = JSON.parse(plaintext);
                    } catch (err) {
                        throw new DecryptionError("PLAINTEXT_NOT_JSON", event, {plaintext, err});
                    }
                    if (payload.room_id !== this.key.roomId) {
                        throw new DecryptionError("MEGOLM_WRONG_ROOM", event,
                            {encryptedRoomId: payload.room_id, eventRoomId: this.key.roomId});
                    }
                    replayEntries.push(new ReplayDetectionEntry(this.key.sessionId, decryptionResult!.message_index, event));
                    const result = new DecryptionResult(payload, this.key.senderKey, this.key.claimedEd25519Key, event);
                    results.set(event.event_id, result);
                } catch (err) {
                    // ignore AbortError from cancelling decryption requests in dispose method
                    if (err.name === "AbortError") {
                        return;
                    }
                    if (!errors) {
                        errors = new Map();
                    }
                    errors.set(event.event_id, err);
                }
            }
        });

        return {results, errors, replayEntries};
    }

    dispose() {
        if (this.decryptionRequests) {
            for (const r of this.decryptionRequests) {
                r.abort();
            }
        }
    }
}
