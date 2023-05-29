/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import type {SecretStorage} from "./SecretStorage";
import type {SharedSecret} from "./SharedSecret";

/**
 * This is a wrapper around SecretStorage and SecretSharing so that 
 * you don't need to always check both sources for something.
 */
export class SecretFetcher {
    public secretStorage: SecretStorage;
    public secretSharing: SharedSecret;

    async getSecret(name: string): Promise<string | undefined> {
        ;
        return await this.secretStorage?.readSecret(name) ??
            await this.secretSharing?.getLocallyStoredSecret(name);
        // note that we don't ask another device for secret here
        // that should be done explicitly since it can take arbitrary
        // amounts of time to be fulfilled as the other devices may 
        // be offline etc...
    } 

    setSecretStorage(storage: SecretStorage) {
        this.secretStorage = storage;
    }

    setSecretSharing(sharing: SharedSecret) {
        this.secretSharing = sharing;
    }
}
