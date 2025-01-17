/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export class PendingAnnotation {
    constructor() {
        // TODO: use simple member for reaction and redaction as we can't/shouldn't really have more than 2 entries
        // this contains both pending annotation entries, and pending redactions of remote annotation entries 
        this._entries = [];
    }

    get firstTimestamp() {
        return this._entries.reduce((ts, e) => {
            if (e.isRedaction) {
                return ts;
            }
            return Math.min(e.timestamp, ts);
        }, Number.MAX_SAFE_INTEGER);
    }

    get annotationEntry() {
        return this._entries.find(e => !e.isRedaction);
    }

    get redactionEntry() {
        return this._entries.find(e => e.isRedaction);
    }

    get count() {
        return this._entries.reduce((count, e) => {
            return count + (e.isRedaction ? -1 : 1);
        }, 0);
    }

    add(entry) {
        this._entries.push(entry);
    }

    remove(entry) {
        const idx = this._entries.indexOf(entry);
        if (idx === -1) {
            return false;
        }
        this._entries.splice(idx, 1);
        return true;
    }

    get willAnnotate() {
        const lastEntry = this._entries.reduce((lastEntry, e) => {
            if (!lastEntry || e.pendingEvent.queueIndex > lastEntry.pendingEvent.queueIndex) {
                return e;
            }
            return lastEntry;
        }, null);
        if (lastEntry) {
            return !lastEntry.isRedaction;
        }
        return false;
    }

    get isEmpty() {
        return this._entries.length === 0;
    }
}
