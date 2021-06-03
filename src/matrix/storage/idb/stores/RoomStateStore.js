/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {MAX_UNICODE} from "./common.js";

function encodeKey(roomId, eventType, stateKey) {
     return `${roomId}|${eventType}|${stateKey}`;
}

export class RoomStateStore {
    constructor(idbStore) {
        this._roomStateStore = idbStore;
    }

    get(roomId, type, stateKey) {
        const key = encodeKey(roomId, type, stateKey);
        return this._roomStateStore.get(key);
    }

    set(roomId, event) {
        const key = encodeKey(roomId, event.type, event.state_key);
        const entry = {roomId, event, key};
        return this._roomStateStore.put(entry);
    }

    removeAllForRoom(roomId) {
        // exclude both keys as they are theoretical min and max,
        // but we should't have a match for just the room id, or room id with max
        const range = this._roomStateStore.IDBKeyRange.bound(roomId, `${roomId}|${MAX_UNICODE}`, true, true);
        this._roomStateStore.delete(range);
    }
}
