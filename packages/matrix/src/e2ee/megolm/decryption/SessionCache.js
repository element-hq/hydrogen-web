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

import {BaseLRUCache} from "../../../../utils/LRUCache.js";
const DEFAULT_CACHE_SIZE = 10;

/**
 * Cache of unpickled inbound megolm session.
 */
export class SessionCache extends BaseLRUCache {
    constructor(limit) {
        limit = typeof limit === "number" ? limit : DEFAULT_CACHE_SIZE;
        super(limit);
    }

    /**
     * @param  {string} roomId
     * @param  {string} senderKey
     * @param  {string} sessionId
     * @return {SessionInfo?}
     */
    get(roomId, senderKey, sessionId) {
        return this._get(s => {
            return s.roomId === roomId &&
                s.senderKey === senderKey &&
                sessionId === s.sessionId;
        });
    }

    add(sessionInfo) {
        sessionInfo.retain();
        this._set(sessionInfo, s => {
            return s.roomId === sessionInfo.roomId &&
                s.senderKey === sessionInfo.senderKey &&
                s.sessionId === sessionInfo.sessionId;
        });
    }

    _onEvictEntry(sessionInfo) {
        sessionInfo.release();
    }

    dispose() {
        for (const sessionInfo of this._entries) {
            sessionInfo.release();
        }
    }
}
