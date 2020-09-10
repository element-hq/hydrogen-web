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

const CACHE_MAX_SIZE = 10;

/**
 * Cache of unpickled inbound megolm session.
 */
export class SessionCache {
    constructor() {
        this._sessions = [];
    }

    /**
     * @param  {string} roomId
     * @param  {string} senderKey
     * @param  {string} sessionId
     * @return {SessionInfo?}
     */
    get(roomId, senderKey, sessionId) {
        const idx = this._sessions.findIndex(s => {
            return s.roomId === roomId &&
                s.senderKey === senderKey &&
                sessionId === s.session.session_id();
        });
        if (idx !== -1) {
            const sessionInfo = this._sessions[idx];
            // move to top
            if (idx > 0) {
                this._sessions.splice(idx, 1);
                this._sessions.unshift(sessionInfo);
            }
            return sessionInfo;
        }
    }

    add(sessionInfo) {
        sessionInfo.retain();
        // add new at top
        this._sessions.unshift(sessionInfo);
        if (this._sessions.length > CACHE_MAX_SIZE) {
            // free sessions we're about to remove
            for (let i = CACHE_MAX_SIZE; i < this._sessions.length; i += 1) {
                this._sessions[i].release();
            }
            this._sessions = this._sessions.slice(0, CACHE_MAX_SIZE);
        }
    }

    dispose() {
        for (const sessionInfo of this._sessions) {
            sessionInfo.release();
        }
    }
}
