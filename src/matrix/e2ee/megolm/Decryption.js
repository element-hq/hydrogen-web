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

export class Decryption {
    constructor({pickleKey, olm}) {
        this._pickleKey = pickleKey;
        this._olm = olm;
    }

    async addRoomKeys(payloads, txn) {
        const newSessions = [];
        for (const {senderKey, event} of payloads) {
            const roomId = event.content?.["room_id"];
            const sessionId = event.content?.["session_id"];
            const sessionKey = event.content?.["session_key"];

            if (
                typeof roomId !== "string" || 
                typeof sessionId !== "string" || 
                typeof senderKey !== "string" ||
                typeof sessionKey !== "string"
            ) {
                return;
            }

            const hasSession = await txn.inboundGroupSessions.has(roomId, senderKey, sessionId);
            if (!hasSession) {
                const session = new this._olm.InboundGroupSession();
                try {
                    session.create(sessionKey);
                    const sessionEntry = {
                        roomId,
                        senderKey,
                        sessionId,
                        session: session.pickle(this._pickleKey),
                        claimedKeys: event.keys,
                    };
                    txn.inboundGroupSessions.set(sessionEntry);
                    newSessions.push(sessionEntry);
                } finally {
                    session.free();
                }
            }

        }
        return newSessions;
    }

    applyRoomKeyChanges(newSessions) {
        // retry decryption with the new sessions
        if (newSessions.length) {
            console.log(`I have ${newSessions.length} new inbound group sessions`, newSessions)
        }
    }
}
