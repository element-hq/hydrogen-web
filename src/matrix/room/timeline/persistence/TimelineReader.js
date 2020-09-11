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
import {Direction} from "../Direction.js";
import {EventEntry} from "../entries/EventEntry.js";
import {FragmentBoundaryEntry} from "../entries/FragmentBoundaryEntry.js";

class ReaderRequest {
    constructor(fn) {
        this.decryptRequest = null;
        this._promise = fn(this);
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

    _openTxn() {
        const stores = [
            this._storage.storeNames.timelineEvents,
            this._storage.storeNames.timelineFragments,
        ];
        if (this._decryptEntries) {
            stores.push(this._storage.storeNames.inboundGroupSessions);
        }
        return this._storage.readTxn(stores);
    }

    readFrom(eventKey, direction, amount) {
        return new ReaderRequest(async r => {
            const txn = await this._openTxn();
            return await this._readFrom(eventKey, direction, amount, r, txn);
        });
    }

    readFromEnd(amount) {
        return new ReaderRequest(async r => {
            const txn = await this._openTxn();
            const liveFragment = await txn.timelineFragments.liveFragment(this._roomId);
            let entries;
            // room hasn't been synced yet
            if (!liveFragment) {
                entries = [];
            } else {
                this._fragmentIdComparer.add(liveFragment);
                const liveFragmentEntry = FragmentBoundaryEntry.end(liveFragment, this._fragmentIdComparer);
                const eventKey = liveFragmentEntry.asEventKey();
                entries = await this._readFrom(eventKey, Direction.Backward, amount, r, txn);
                entries.unshift(liveFragmentEntry);
            }
            return entries;
        });
    }

    async _readFrom(eventKey, direction, amount, r, txn) {
        let entries = [];
        const timelineStore = txn.timelineEvents;
        const fragmentStore = txn.timelineFragments;
        
        while (entries.length < amount && eventKey) {
            let eventsWithinFragment;
            if (direction.isForward) {
                eventsWithinFragment = await timelineStore.eventsAfter(this._roomId, eventKey, amount);
            } else {
                eventsWithinFragment = await timelineStore.eventsBefore(this._roomId, eventKey, amount);
            }
            let eventEntries = eventsWithinFragment.map(e => new EventEntry(e, this._fragmentIdComparer));
            entries = directionalConcat(entries, eventEntries, direction);
            // prepend or append eventsWithinFragment to entries, and wrap them in EventEntry

            if (entries.length < amount) {
                const fragment = await fragmentStore.get(this._roomId, eventKey.fragmentId);
                // this._fragmentIdComparer.addFragment(fragment);
                let fragmentEntry = new FragmentBoundaryEntry(fragment, direction.isBackward, this._fragmentIdComparer);
                // append or prepend fragmentEntry, reuse func from GapWriter?
                directionalAppend(entries, fragmentEntry, direction);
                // only continue loading if the fragment boundary can't be backfilled
                if (!fragmentEntry.token && fragmentEntry.hasLinkedFragment) {
                    const nextFragment = await fragmentStore.get(this._roomId, fragmentEntry.linkedFragmentId);
                    this._fragmentIdComparer.add(nextFragment);
                    const nextFragmentEntry = new FragmentBoundaryEntry(nextFragment, direction.isForward, this._fragmentIdComparer);
                    directionalAppend(entries, nextFragmentEntry, direction);
                    eventKey = nextFragmentEntry.asEventKey();
                } else {
                    eventKey = null;
                }
            }
        }

        if (this._decryptEntries) {
            r.decryptRequest = this._decryptEntries(entries, txn);
            try {
                await r.decryptRequest.complete();
            } finally {
                r.decryptRequest = null;
            }
        }
        return entries;
    }
}
