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

export function createSessionEntry(olmSession, senderKey, timestamp, pickleKey) {
    return {
        session: olmSession.pickle(pickleKey),
        sessionId: olmSession.session_id(),
        senderKey,
        lastUsed: timestamp,
    };
}

export class Session {
    constructor(data, pickleKey, olm, isNew = false) {
        this.data = data;
        this._olm = olm;
        this._pickleKey = pickleKey;
        this.isNew = isNew;
        this.isModified = isNew;
    }

    static create(senderKey, olmSession, olm, pickleKey, timestamp) {
        const data = createSessionEntry(olmSession, senderKey, timestamp, pickleKey);
        return new Session(data, pickleKey, olm, true);
    }

    get id() {
        return this.data.sessionId;
    }

    load() {
        const session = new this._olm.Session();
        session.unpickle(this._pickleKey, this.data.session);
        return session;
    }

    unload(olmSession) {
        olmSession.free();
    }

    save(olmSession) {
        this.data.session = olmSession.pickle(this._pickleKey);
        this.isModified = true;
    }
}
