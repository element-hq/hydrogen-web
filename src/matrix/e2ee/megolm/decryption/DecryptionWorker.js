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

export class DecryptionWorker {
    constructor(worker) {
        this._worker = worker;
        this._requests = new Map();
        this._counter = 0;
        this._worker.addEventListener("message", this);
    }

    handleEvent(e) {
        if (e.type === "message") {
            const message = e.data;
            console.log("worker reply", message);
            const request = this._requests.get(message.replyToId);
            if (request) {
                if (message.type === "success") {
                    request.resolve(message.payload);
                } else if (message.type === "error") {
                    request.reject(new Error(message.stack));
                }
                this._requests.delete(message.ref_id);
            }
        }
    }

    _send(message) {
        this._counter += 1;
        message.id = this._counter;
        let resolve;
        let reject;
        const promise = new Promise((_resolve, _reject) => {
            resolve = _resolve;
            reject = _reject;
        });
        this._requests.set(message.id, {reject, resolve});
        this._worker.postMessage(message);
        return promise;
    }

    decrypt(session, ciphertext) {
        const sessionKey = session.export_session(session.first_known_index());
        return this._send({type: "megolm_decrypt", ciphertext, sessionKey});
    }

    init() {
        return this._send({type: "load_olm", path: "olm_legacy-3232457086.js"});
        // return this._send({type: "load_olm", path: "../lib/olm/olm_legacy.js"});
    }
}
