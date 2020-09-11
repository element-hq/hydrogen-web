/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {SortedArray, MappedList, ConcatList} from "../../../observable/index.js";
import {Disposables} from "../../../utils/Disposables.js";
import {Direction} from "./Direction.js";
import {TimelineReader} from "./persistence/TimelineReader.js";
import {PendingEventEntry} from "./entries/PendingEventEntry.js";

export class Timeline {
    constructor({roomId, storage, closeCallback, fragmentIdComparer, pendingEvents, user, clock}) {
        this._roomId = roomId;
        this._storage = storage;
        this._closeCallback = closeCallback;
        this._fragmentIdComparer = fragmentIdComparer;
        this._disposables = new Disposables();
        this._remoteEntries = new SortedArray((a, b) => a.compare(b));
        this._timelineReader = new TimelineReader({
            roomId: this._roomId,
            storage: this._storage,
            fragmentIdComparer: this._fragmentIdComparer
        });
        this._readerRequest = null;
        const localEntries = new MappedList(pendingEvents, pe => {
            return new PendingEventEntry({pendingEvent: pe, user, clock});
        }, (pee, params) => {
            pee.notifyUpdate(params);
        });
        this._allEntries = new ConcatList(this._remoteEntries, localEntries);
    }

    /** @package */
    async load() {
        // 30 seems to be a good amount to fill the entire screen
        const readerRequest = this._disposables.track(this._timelineReader.readFromEnd(30));
        try {
            const entries = await readerRequest.complete();
            this._remoteEntries.setManySorted(entries);
        } finally {
            this._disposables.disposeTracked(readerRequest);
        }
    }

    replaceEntries(entries) {
        for (const entry of entries) {
            this._remoteEntries.replace(entry);
        }
    }

    // TODO: should we rather have generic methods for
    // - adding new entries
    // - updating existing entries (redaction, relations)
    /** @package */
    appendLiveEntries(newEntries) {
        this._remoteEntries.setManySorted(newEntries);
    }

    /** @package */
    addGapEntries(newEntries) {
        this._remoteEntries.setManySorted(newEntries);
    }
    
    // tries to prepend `amount` entries to the `entries` list.
    async loadAtTop(amount) {
        const firstEventEntry = this._remoteEntries.array.find(e => !!e.eventType);
        if (!firstEventEntry) {
            return;
        }
        const readerRequest = this._disposables.track(this._timelineReader.readFrom(
            firstEventEntry.asEventKey(),
            Direction.Backward,
            amount
        ));
        try {
            const entries = await readerRequest.complete();
            this._remoteEntries.setManySorted(entries);
        } finally {
            this._disposables.disposeTracked(readerRequest);
        }
    }

    /** @public */
    get entries() {
        return this._allEntries;
    }

    /** @public */
    dispose() {
        if (this._closeCallback) {
            this._disposables.dispose();
            this._closeCallback();
            this._closeCallback = null;
        }
    }

    enableEncryption(decryptEntries) {
        this._timelineReader.enableEncryption(decryptEntries);
    }
}
