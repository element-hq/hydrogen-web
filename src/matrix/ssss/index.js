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

import {KeyDescription, Key} from "./common.js";
import {keyFromPassphrase} from "./passphrase.js";
import {keyFromRecoveryKey} from "./recoveryKey.js";
import {SESSION_E2EE_KEY_PREFIX} from "../e2ee/common.js";
import {createEnum} from "../../utils/enum.js";

const SSSS_KEY = `${SESSION_E2EE_KEY_PREFIX}ssssKey`;

export const KeyType = createEnum("RecoveryKey", "Passphrase");

async function readDefaultKeyDescription(storage) {
    const txn = await storage.readTxn([
        storage.storeNames.accountData
    ]);
    const defaultKeyEvent = await txn.accountData.get("m.secret_storage.default_key");
    const id = defaultKeyEvent?.content?.key;
    if (!id) {
        return;
    }
    const keyAccountData = await txn.accountData.get(`m.secret_storage.key.${id}`);
    if (!keyAccountData) {
        return;
    }
    return new KeyDescription(id, keyAccountData.content);
}

export async function writeKey(key, txn) {
    txn.session.set(SSSS_KEY, {id: key.id, binaryKey: key.binaryKey});
}

export async function readKey(txn) {
    const keyData = await txn.session.get(SSSS_KEY);
    if (!keyData) {
        return;
    }
    const keyAccountData = await txn.accountData.get(`m.secret_storage.key.${keyData.id}`);
    if (keyAccountData) {
        return new Key(new KeyDescription(keyData.id, keyAccountData.content), keyData.binaryKey);
    }
}


export async function removeKey(txn) {
    await txn.session.remove(SSSS_KEY);
}

export async function keyFromCredential(type, credential, storage, platform, olm) {
    const keyDescription = await readDefaultKeyDescription(storage);
    if (!keyDescription) {
        throw new Error("Could not find a default secret storage key in account data");
    }
    return await keyFromCredentialAndDescription(type, credential, keyDescription, platform, olm);
}

export async function keyFromCredentialAndDescription(type, credential, keyDescription, platform, olm) {
    let key;
    if (type === KeyType.Passphrase) {
        key = await keyFromPassphrase(keyDescription, credential, platform);
    } else if (type === KeyType.RecoveryKey) {
        key = keyFromRecoveryKey(keyDescription, credential, olm, platform);
    } else {
        throw new Error(`Invalid type: ${type}`);
    }
    return key;
}

export async function keyFromDehydratedDeviceKey(key, storage, platform) {
    const keyDescription = await readDefaultKeyDescription(storage);
    if (await keyDescription.isCompatible(key, platform)) {
        return key.withDescription(keyDescription);
    }
}
