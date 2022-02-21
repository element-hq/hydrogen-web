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
import type {SessionDecryption} from "./SessionDecryption";
import type {ReplayDetectionEntry} from "./ReplayDetectionEntry";

/**
 * Class that contains all the state loaded from storage to decrypt the given events
 */
export class DecryptionPreparation {
    constructor(
        private readonly roomId: string,
        private readonly sessionDecryptions: SessionDecryption[],
        private errors: Map<string, Error>
    ) {}

    async decrypt(): Promise<DecryptionChanges> {
        try {
            const errors = this.errors;
            const results = new Map();
            const replayEntries: ReplayDetectionEntry[] = [];
            await Promise.all(this.sessionDecryptions.map(async sessionDecryption => {
                const sessionResult = await sessionDecryption.decryptAll();
                mergeMap(sessionResult.errors, errors);
                mergeMap(sessionResult.results, results);
                replayEntries.push(...sessionResult.replayEntries);
            }));
            return new DecryptionChanges(this.roomId, results, errors, replayEntries);
        } finally {
            this.dispose();
        }
    }

    dispose(): void {
        for (const sd of this.sessionDecryptions) {
            sd.dispose();
        }
    }
}
