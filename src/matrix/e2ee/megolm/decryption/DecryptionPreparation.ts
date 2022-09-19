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

import {DecryptionChanges} from "./DecryptionChanges";
import {mergeMap} from "../../../../utils/mergeMap";
import type {SessionDecryption} from "./SessionDecryption"
;import type {DecryptionError} from "../../common";
import type {ReplayDetectionEntry} from "./ReplayDetectionEntry";
import type {DecryptionResult} from "../../DecryptionResult";

/**
 * Class that contains all the state loaded from storage to decrypt the given events
 */
export class DecryptionPreparation {
    private _roomId: string;
    private _sessionDecryptions: SessionDecryption[];
    private _initialErrors: Map<string, DecryptionError>;

    constructor(roomId: string, sessionDecryptions: SessionDecryption[], errors: Map<string, DecryptionError>) {
        this._roomId = roomId;
        this._sessionDecryptions = sessionDecryptions;
        this._initialErrors = errors;
    }

    async decrypt(): Promise<DecryptionChanges> {
        try {
            const errors = this._initialErrors;
            const results = new Map<string, DecryptionResult>();
            const replayEntries: ReplayDetectionEntry[] = [];
            await Promise.all(this._sessionDecryptions.map(async sessionDecryption => {
                const sessionResult = await sessionDecryption.decryptAll();
                mergeMap(sessionResult.errors, errors);
                mergeMap(sessionResult.results, results);
                replayEntries.push(...sessionResult.replayEntries);
            }));
            return new DecryptionChanges(this._roomId, results, errors, replayEntries);
        } finally {
            this.dispose();
        }
    }

    dispose(): void {
        for (const sd of this._sessionDecryptions) {
            sd.dispose();
        }
    }
}
