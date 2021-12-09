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
        this._randomValues = self.crypto ? null : [];
    }

    _feedRandomValues(randomValues) {
        if (this._randomValues) {
            this._randomValues.push(...randomValues);
        }
    }

    _checkRandomValuesUsed() {
        if (this._randomValues && this._randomValues.length !== 0) {
            throw new Error(`${this._randomValues.length} random values left`);
        }
    }

    _getRandomValues(typedArray) {
        if (!(typedArray instanceof Uint8Array)) {
            throw new Error("only Uint8Array is supported: " + JSON.stringify({
                Int8Array: typedArray instanceof Int8Array,
                Uint8Array: typedArray instanceof Uint8Array,
                Int16Array: typedArray instanceof Int16Array,
                Uint16Array: typedArray instanceof Uint16Array,
                Int32Array: typedArray instanceof Int32Array,
                Uint32Array: typedArray instanceof Uint32Array,
            }));
        }
        if (this._randomValues.length === 0) {
            throw new Error("no more random values, needed one of length " + typedArray.length);
        }
        const precalculated = this._randomValues.shift();
        if (precalculated.length !== typedArray.length) {
            throw new Error(`typedArray length (${typedArray.length}) does not match precalculated length (${precalculated.length})`);
        }
        // copy values
        for (let i = 0; i < typedArray.length; ++i) {
            typedArray[i] = precalculated[i];
        }
        return typedArray;
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
            const payload = fn();
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
            if (!self.crypto) {
                self.crypto = {getRandomValues: this._getRandomValues.bind(this)};
            }
            // mangle the globals enough to make olm believe it is running in a browser
            self.window = self;
            self.document = {};
            self.importScripts(path);
            const olm = self.Olm;
            await olm.init();
            this._olm = olm;
        });
    }

    _megolmDecrypt(sessionKey, ciphertext) {
        return this._toMessage(() => {
            const session = new this._olm.InboundGroupSession();
            try {
                session.import_session(sessionKey);
                // returns object with plaintext and message_index
                return session.decrypt(ciphertext);
            } finally {
                session.free();
            }
        });
    }

    _olmCreateAccountAndOTKs(randomValues, otkAmount) {
        return this._toMessage(() => {
            this._feedRandomValues(randomValues);
            const account = new this._olm.Account();
            try {
                account.create();
                account.generate_one_time_keys(otkAmount);
                this._checkRandomValuesUsed();
                return account.pickle("");
            } finally {
                account.free();
            }
        });
    }

    _olmCreateOutbound(randomValues, accountPickle, theirIdentityKey, theirOneTimeKey) {
        return this._toMessage(() => {
            this._feedRandomValues(randomValues);
            const account = new this._olm.Account();
            const newSession = new this._olm.Session();
            try {
                account.unpickle("", accountPickle);
                newSession.create_outbound(account, theirIdentityKey, theirOneTimeKey);
                return newSession.pickle("");
            } finally {
                account.free();
                newSession.free();
            }
        });
    }

    async _handleMessage(message) {
        const {type} = message;
        if (type === "ping") {
            this._sendReply(message, {type: "success"});
        } else if (type === "load_olm") {
            this._sendReply(message, await this._loadOlm(message.path));
        } else if (type === "megolm_decrypt") {
            this._sendReply(message, this._megolmDecrypt(message.sessionKey, message.ciphertext));
        } else if (type === "olm_create_account_otks") {
            this._sendReply(message, this._olmCreateAccountAndOTKs(message.randomValues, message.otkAmount));
        } else if (type === "olm_create_outbound") {
            this._sendReply(message, this._olmCreateOutbound(message.randomValues, message.accountPickle, message.theirIdentityKey, message.theirOneTimeKey));
        }
    }
}

self.addEventListener("message", new MessageHandler());
