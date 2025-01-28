/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
