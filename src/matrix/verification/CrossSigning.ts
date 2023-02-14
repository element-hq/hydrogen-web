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

import type {SecretStorage} from "../ssss/SecretStorage";
import type {Storage} from "../storage/idb/Storage";
import type {Platform} from "../../platform/web/Platform";
import type {DeviceTracker} from "../e2ee/DeviceTracker";
import type * as OlmNamespace from "@matrix-org/olm";
import type {HomeServerApi} from "../net/HomeServerApi";
type Olm = typeof OlmNamespace;

export class CrossSigning {
    private readonly storage: Storage;
    private readonly secretStorage: SecretStorage;
    private readonly platform: Platform;
    private readonly deviceTracker: DeviceTracker;
    private readonly olm: Olm;
    private readonly hsApi: HomeServerApi;
    private readonly ownUserId: string;
    private _isMasterKeyTrusted: boolean = false;

    constructor(options: {storage: Storage, secretStorage: SecretStorage, deviceTracker: DeviceTracker,  platform: Platform, olm: Olm, ownUserId: string, hsApi: HomeServerApi}) {
        this.storage = options.storage;
        this.secretStorage = options.secretStorage;
        this.platform = options.platform;
        this.deviceTracker = options.deviceTracker;
        this.olm = options.olm;
        this.hsApi = options.hsApi;
        this.ownUserId = options.ownUserId;
    }

    async init(log) {
        // use errorboundary here
        const txn = await this.storage.readTxn([this.storage.storeNames.accountData]);
        
        const mskSeed = await this.secretStorage.readSecret("m.cross_signing.master", txn);
        const signing = new this.olm.PkSigning();
        let derivedPublicKey;
        try {
            const seed = new Uint8Array(this.platform.encoding.base64.decode(mskSeed));
            derivedPublicKey = signing.init_with_seed(seed);    
        } finally {
            signing.free();
        }
        const publishedMasterKey = await this.deviceTracker.getMasterKeyForUser(this.ownUserId, this.hsApi, log);
        log.set({publishedMasterKey, derivedPublicKey});
        this._isMasterKeyTrusted = publishedMasterKey === derivedPublicKey;
        log.set("isMasterKeyTrusted", this.isMasterKeyTrusted);
    }

    get isMasterKeyTrusted(): boolean {
        return this._isMasterKeyTrusted;
    }
}

