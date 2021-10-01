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

/**
 * session loaded in memory with everything needed to create DecryptionResults
 * and to store/retrieve it in the SessionCache
 */
export class SessionInfo {
    constructor(roomId, senderKey, session, claimedKeys) {
        this.roomId = roomId;
        this.senderKey = senderKey;
        this.session = session;
        this.claimedKeys = claimedKeys;
        this._refCounter = 0;
    }

    get sessionId() {
        return this.session?.session_id();
    }

    retain() {
        this._refCounter += 1;
    }

    release() {
        this._refCounter -= 1;
        if (this._refCounter <= 0) {
            this.dispose();
        }
    }

    dispose() {
        this.session.free();
        this.session = null;
    }
}
