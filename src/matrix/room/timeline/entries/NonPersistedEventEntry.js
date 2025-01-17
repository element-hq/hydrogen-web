/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {EventEntry} from "./EventEntry.js";

// EventEntry but without the two properties that are populated via SyncWriter
// Useful if you want to create an EventEntry that is ephemeral

export class NonPersistedEventEntry extends EventEntry {
    get fragmentId() {
        throw new Error("Cannot access fragmentId for non-persisted EventEntry");
    }

    get entryIndex() {
        throw new Error("Cannot access entryIndex for non-persisted EventEntry");
    }

    get isNonPersisted() {
        return true;
    }

    // overridden here because we reuse addLocalRelation() for updating this entry
    // we don't want the RedactedTile created using this entry to ever show "is being redacted"
    get isRedacting() {
        return false;
    }

    get isRedacted() {
        return super.isRedacting;
    }
}
