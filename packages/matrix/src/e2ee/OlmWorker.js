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

export class OlmWorker {
    constructor(workerPool) {
        this._workerPool = workerPool;
    }

    megolmDecrypt(session, ciphertext) {
        const sessionKey = session.export_session(session.first_known_index());
        return this._workerPool.send({type: "megolm_decrypt", ciphertext, sessionKey});
    }

    async createAccountAndOTKs(account, otkAmount) {
        // IE11 does not support getRandomValues in a worker, so we have to generate the values upfront.
        let randomValues;
        if (window.msCrypto) {
            randomValues = [
                window.msCrypto.getRandomValues(new Uint8Array(64)),
                window.msCrypto.getRandomValues(new Uint8Array(otkAmount * 32)),
            ];
        }
        const pickle = await this._workerPool.send({type: "olm_create_account_otks", randomValues, otkAmount}).response();
        account.unpickle("", pickle);
    }

    async createOutboundOlmSession(account, newSession, theirIdentityKey, theirOneTimeKey) {
        const accountPickle = account.pickle("");
        let randomValues;
        if (window.msCrypto) {
            randomValues = [
                window.msCrypto.getRandomValues(new Uint8Array(64)),
            ];
        }
        const sessionPickle = await this._workerPool.send({type: "olm_create_outbound", accountPickle, theirIdentityKey, theirOneTimeKey, randomValues}).response();
        newSession.unpickle("", sessionPickle);
    }

    dispose() {
        this._workerPool.dispose();
    }
}
