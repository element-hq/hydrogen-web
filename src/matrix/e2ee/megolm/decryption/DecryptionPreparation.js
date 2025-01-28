/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {DecryptionChanges} from "./DecryptionChanges.js";
import {mergeMap} from "../../../../utils/mergeMap";

/**
 * Class that contains all the state loaded from storage to decrypt the given events
 */
export class DecryptionPreparation {
    constructor(roomId, sessionDecryptions, errors) {
        this._roomId = roomId;
        this._sessionDecryptions = sessionDecryptions;
        this._initialErrors = errors;
    }

    async decrypt() {
        try {
            const errors = this._initialErrors;
            const results = new Map();
            const replayEntries = [];
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

    dispose() {
        for (const sd of this._sessionDecryptions) {
            sd.dispose();
        }
    }
}
