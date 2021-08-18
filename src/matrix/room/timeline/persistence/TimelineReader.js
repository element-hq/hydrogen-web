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

import {directionalConcat, directionalAppend} from "./common.js";
import {Direction} from "../Direction";
import {EventEntry} from "../entries/EventEntry.js";
import {FragmentBoundaryEntry} from "../entries/FragmentBoundaryEntry.js";

class ReaderRequest {
    constructor(fn, log) {
        this.decryptRequest = null;
        this._promise = fn(this, log);
    }

    complete() {
        return this._promise;
    }

    dispose() {
        if (this.decryptRequest) {
            this.decryptRequest.dispose();
            this.decryptRequest = null;
        }
    }
}

/**
 * Raw because it doesn't do decryption and in the future it should not read relations either.
 * It is just about reading entries and following fragment links
 */
async function readRawTimelineEntriesWithTxn(roomId, eventKey, direction, amount, fragmentIdComparer, txn) {
    let entries = [];
    const timelineStore = txn.timelineEvents;
    const fragmentStore = txn.timelineFragments;

    while (entries.length < amount && eventKey) {
        let eventsWithinFragment;
        if (direction.isForward) {
            // TODO: should we pass amount - entries.length here?
            eventsWithinFragment = await timelineStore.eventsAfter(roomId, eventKey, amount);
        } else {
            eventsWithinFragment = await timelineStore.eventsBefore(roomId, eventKey, amount);
        }
        let eventEntries = eventsWithinFragment.map(e => new EventEntry(e, fragmentIdComparer));
        entries = directionalConcat(entries, eventEntries, direction);
        // prepend or append eventsWithinFragment to entries, and wrap them in EventEntry

        if (entries.length < amount) {
            const fragment = await fragmentStore.get(roomId, eventKey.fragmentId);
            // TODO: why does the first fragment not need to be added? (the next *is* added below)
            // it looks like this would be fine when loading in the sync island
            // (as the live fragment should be added already) but not for permalinks when we support them
            // 
            // fragmentIdComparer.addFragment(fragment);
            let fragmentEntry = new FragmentBoundaryEntry(fragment, direction.isBackward, fragmentIdComparer);
            // append or prepend fragmentEntry, reuse func from GapWriter?
            directionalAppend(entries, fragmentEntry, direction);
            // only continue loading if the fragment boundary can't be backfilled
            if (!fragmentEntry.token && fragmentEntry.hasLinkedFragment) {
                const nextFragment = await fragmentStore.get(roomId, fragmentEntry.linkedFragmentId);
                fragmentIdComparer.add(nextFragment);
                const nextFragmentEntry = new FragmentBoundaryEntry(nextFragment, direction.isForward, fragmentIdComparer);
                directionalAppend(entries, nextFragmentEntry, direction);
                eventKey = nextFragmentEntry.asEventKey();
            } else {
                eventKey = null;
            }
        }
    }
    return entries;
}

export class TimelineReader {
    constructor({roomId, storage, fragmentIdComparer}) {
        this._roomId = roomId;
        this._storage = storage;
        this._fragmentIdComparer = fragmentIdComparer;
        this._decryptEntries = null;
    }

    enableEncryption(decryptEntries) {
        this._decryptEntries = decryptEntries;
    }

    get readTxnStores() {
        const stores = [
            this._storage.storeNames.timelineEvents,
            this._storage.storeNames.timelineFragments,
        ];
        if (this._decryptEntries) {
            stores.push(this._storage.storeNames.inboundGroupSessions);
        }
        return stores;
    }

    readFrom(eventKey, direction, amount, log) {
        return new ReaderRequest(async (r, log) => {
            const txn = await this._storage.readTxn(this.readTxnStores);
            return await this._readFrom(eventKey, direction, amount, r, txn, log);
        }, log);
    }

    readFromEnd(amount, existingTxn = null, log) {
        return new ReaderRequest(async (r, log) => {
            const txn = existingTxn || await this._storage.readTxn(this.readTxnStores);
            const liveFragment = await txn.timelineFragments.liveFragment(this._roomId);
            let entries;
            // room hasn't been synced yet
            if (!liveFragment) {
                entries = [];
            } else {
                this._fragmentIdComparer.add(liveFragment);
                const liveFragmentEntry = FragmentBoundaryEntry.end(liveFragment, this._fragmentIdComparer);
                const eventKey = liveFragmentEntry.asEventKey();
                entries = await this._readFrom(eventKey, Direction.Backward, amount, r, txn, log);
                entries.unshift(liveFragmentEntry);
            }
            return entries;
        }, log);
    }

    async _readFrom(eventKey, direction, amount, r, txn, log) {
        const entries = await readRawTimelineEntriesWithTxn(this._roomId, eventKey, direction, amount, this._fragmentIdComparer, txn);
        if (this._decryptEntries) {
            r.decryptRequest = this._decryptEntries(entries, txn, log);
            try {
                await r.decryptRequest.complete();
            } finally {
                r.decryptRequest = null;
            }
        }
        return entries;
    }
}
