/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {KeyDescription, Key} from "./common";
import {keyFromPassphrase} from "./passphrase";
import {keyFromRecoveryKey} from "./recoveryKey";
import {SESSION_E2EE_KEY_PREFIX} from "../e2ee/common";
import type {Storage} from "../storage/idb/Storage";
import type {Transaction} from "../storage/idb/Transaction";
import type {KeyDescriptionData} from "./common";
import type {Platform} from "../../platform/web/Platform.js";
import type * as OlmNamespace from "@matrix-org/olm"

// Add exports for other classes
export {SecretFetcher} from "./SecretFetcher";
export {SecretSharing} from "./SecretSharing";
export {SecretStorage} from "./SecretStorage";

type Olm = typeof OlmNamespace;

const SSSS_KEY = `${SESSION_E2EE_KEY_PREFIX}ssssKey`;
const BACKUPVERSION_KEY = `${SESSION_E2EE_KEY_PREFIX}keyBackupVersion`;

export enum KeyType {
    "RecoveryKey",
    "Passphrase"
}

async function readDefaultKeyDescription(storage: Storage): Promise<KeyDescription | undefined> {
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
    return new KeyDescription(id, keyAccountData.content as KeyDescriptionData);
}

export async function writeKey(key: Key, keyBackupVersion: number, txn: Transaction): Promise<number | undefined> {
    const existingVersion: number | undefined = await txn.session.get(BACKUPVERSION_KEY);
    txn.session.set(BACKUPVERSION_KEY, keyBackupVersion);
    txn.session.set(SSSS_KEY, {id: key.id, binaryKey: key.binaryKey});
    return existingVersion;
}

export async function readKey(txn: Transaction): Promise<Key | undefined> {
    const keyData = await txn.session.get(SSSS_KEY);
    if (!keyData) {
        return;
    }
    const keyAccountData = await txn.accountData.get(`m.secret_storage.key.${keyData.id}`);
    if (keyAccountData) {
        return new Key(new KeyDescription(keyData.id, keyAccountData.content as KeyDescriptionData), keyData.binaryKey);
    }
}


export async function removeKey(txn: Transaction): Promise<void> {
    txn.session.remove(SSSS_KEY);
}

export async function keyFromCredential(type: KeyType, credential: string, storage: Storage, platform: Platform, olm: Olm): Promise<Key> {
    const keyDescription = await readDefaultKeyDescription(storage);
    if (!keyDescription) {
        throw new Error("Could not find a default secret storage key in account data");
    }
    return await keyFromCredentialAndDescription(type, credential, keyDescription, platform, olm);
}

export async function keyFromCredentialAndDescription(type: KeyType, credential: string, keyDescription: KeyDescription, platform: Platform, olm: Olm): Promise<Key> {
    let key: Key;
    if (type === KeyType.Passphrase) {
        key = await keyFromPassphrase(keyDescription, credential, platform);
    } else if (type === KeyType.RecoveryKey) {
        key = keyFromRecoveryKey(keyDescription, credential, olm, platform);
    } else {
        throw new Error(`Invalid type: ${type}`);
    }
    return key;
}

export async function keyFromDehydratedDeviceKey(key: Key, storage: Storage, platform: Platform): Promise<Key | undefined> {
    const keyDescription = await readDefaultKeyDescription(storage);
    if (await keyDescription?.isCompatible(key, platform)) {
        return key.withDescription(keyDescription!);
    }
}
