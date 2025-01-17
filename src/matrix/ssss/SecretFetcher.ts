/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {SecretStorage} from "./SecretStorage";
import type {SecretSharing} from "./SecretSharing";

/**
 * This is a wrapper around SecretStorage and SecretSharing so that 
 * you don't need to check both sources for a secret.
 */
export class SecretFetcher {
    public secretStorage: SecretStorage;
    public secretSharing: SecretSharing;

    async getSecret(name: string): Promise<string | undefined> {
        /**
         * Note that we don't ask another device for secret here;
         * that should be done explicitly since it can take arbitrary
         * amounts of time to be fulfilled as the other devices may 
         * be offline etc...
         */
        return await this.secretStorage?.readSecret(name) ??
            await this.secretSharing?.getLocallyStoredSecret(name);
    } 

    setSecretStorage(storage: SecretStorage) {
        this.secretStorage = storage;
    }

    setSecretSharing(sharing: SecretSharing) {
        this.secretSharing = sharing;
        /**
         * SecretSharing also needs to respond to secret requests
         * from other devices, so it needs the secret fetcher as 
         * well
         */
        this.secretSharing.setSecretFetcher(this);
    }
}
