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

export class KeyDescription {
    constructor(id, keyAccountData) {
        this._id = id;
        this._keyAccountData = keyAccountData;
    }

    get id() {
        return this._id;
    }

    get passphraseParams() {
        return this._keyAccountData?.content?.passphrase;
    }

    get algorithm() {
        return this._keyAccountData?.content?.algorithm;
    }
}

export class Key {
    constructor(keyDescription, binaryKey) {
        this._keyDescription = keyDescription;
        this._binaryKey = binaryKey;
    }

    get id() {
        return this._keyDescription.id;
    }

    get binaryKey() {
        return this._binaryKey;
    }

    get algorithm() {
        return this._keyDescription.algorithm;
    }
}

export async function readDefaultKeyDescription(storage) {
    const txn = await storage.readTxn([
        storage.storeNames.accountData
    ]);
    const defaultKeyEvent = await txn.accountData.get("m.secret_storage.default_key");
    const id = defaultKeyEvent?.content?.key;
    if (!id) {
        return;
    }
    const keyAccountData = await txn.accountData.get(`m.secret_storage.key.${id}`);
    return new KeyDescription(id, keyAccountData);
}

export async function writeKey(storage, key) {
    const txn = await storage.readWriteTxn([
        storage.storeNames.session
    ]);
    try {
        txn.session.set("ssssKey", {id: key.id, binaryKey: key.binaryKey});
    } catch (err) {
        txn.abort();
        throw err;
    }
    await txn.complete();
}

export async function readKey(txn) {
    const key = await txn.session.get("ssssKey");
    if (!key) {
        return;
    }
    const keyAccountData = await txn.accountData.get(`m.secret_storage.key.${key.id}`);
    return new Key(new KeyDescription(key.id, keyAccountData), key.binaryKey);
}
