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

function asErrorMessage(err) {
    return {
        type: "error",
        message: err.message,
        stack: err.stack
    };
}

function asSuccessMessage(payload) {
    return {
        type: "success",
        payload
    };
}

class MessageHandler {
    constructor() {
        this._olm = null;
    }

    handleEvent(e) {
        if (e.type === "message") {
            this._handleMessage(e.data);
        }
    }

    _sendReply(refMessage, reply) {
        reply.replyToId = refMessage.id;
        self.postMessage(reply);
    }

    _toMessage(fn) {
        try {
            let payload = fn();
            if (payload instanceof Promise) {
                return payload.then(
                    payload => asSuccessMessage(payload),
                    err => asErrorMessage(err)
                );
            } else {
                return asSuccessMessage(payload);
            }
        } catch (err) {
            return asErrorMessage(err);
        }
    }

    _loadOlm(path) {
        return this._toMessage(async () => {
            // might have some problems here with window vs self as global object?
            if (self.msCrypto && !self.crypto) {
                self.crypto = self.msCrypto;
            }
            self.importScripts(path);
            const olm = self.olm_exports;
            // mangle the globals enough to make olm load believe it is running in a browser
            self.window = self;
            self.document = {};
            await olm.init();
            delete self.document;
            delete self.window;
            this._olm = olm;
        });
    }

    _megolmDecrypt(sessionKey, ciphertext) {
        return this._toMessage(() => {
            let session;
            try {
                session = new this._olm.InboundGroupSession();
                session.import_session(sessionKey);
                // returns object with plaintext and message_index
                return session.decrypt(ciphertext);
            } finally {
                session?.free();
            }
        });
    }

    async _handleMessage(message) {
        switch (message.type) {
            case "load_olm":
                this._sendReply(message, await this._loadOlm(message.path));
                break;
            case "megolm_decrypt":
                this._sendReply(message, this._megolmDecrypt(message.sessionKey, message.ciphertext));
                break;
        }
    }
}

self.addEventListener("message", new MessageHandler());
