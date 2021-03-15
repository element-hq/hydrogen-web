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
import {RoomMember} from "../members/RoomMember.js";

export class Timeline {
    constructor({roomId, storage, closeCallback, fragmentIdComparer, pendingEvents, clock}) {
        this._roomId = roomId;
        this._storage = storage;
        this._closeCallback = closeCallback;
        this._fragmentIdComparer = fragmentIdComparer;
        this._disposables = new Disposables();
        this._remoteEntries = new SortedArray((a, b) => a.compare(b));
        this._ownMember = null;
        this._timelineReader = new TimelineReader({
            roomId: this._roomId,
            storage: this._storage,
            fragmentIdComparer: this._fragmentIdComparer
        });
        this._readerRequest = null;
        const localEntries = new MappedList(pendingEvents, pe => {
            return new PendingEventEntry({pendingEvent: pe, member: this._ownMember, clock});
        }, (pee, params) => {
            pee.notifyUpdate(params);
        });
        this._allEntries = new ConcatList(this._remoteEntries, localEntries);
    }

    /** @package */
    async load(user, log) {
        const txn = await this._storage.readTxn(this._timelineReader.readTxnStores.concat(this._storage.storeNames.roomMembers));
        const memberData = await txn.roomMembers.get(this._roomId, user.id);
        this._ownMember = new RoomMember(memberData);
        // it should be fine to not update the local entries,
        // as they should only populate once the view subscribes to it
        // if they are populated already, the sender profile would be empty

        // 30 seems to be a good amount to fill the entire screen
        const readerRequest = this._disposables.track(this._timelineReader.readFromEnd(30, txn, log));
        try {
            const entries = await readerRequest.complete();
            this._remoteEntries.setManySorted(entries);
        } finally {
            this._disposables.disposeTracked(readerRequest);
        }
    }

    updateOwnMember(member) {
        this._ownMember = member;
    }

    replaceEntries(entries) {
        for (const entry of entries) {
            this._remoteEntries.replace(entry);
        }
    }

    /** @package */
    addOrReplaceEntries(newEntries) {
        this._remoteEntries.setManySorted(newEntries);
    }
    
    // tries to prepend `amount` entries to the `entries` list.
    /**
     * [loadAtTop description]
     * @param  {[type]} amount [description]
     * @return {boolean} true if the top of the timeline has been reached
     * 
     */
    async loadAtTop(amount) {
        if (this._disposables.isDisposed) {
            return true;
        }
        const firstEventEntry = this._remoteEntries.array.find(e => !!e.eventType);
        if (!firstEventEntry) {
            return true;
        }
        const readerRequest = this._disposables.track(this._timelineReader.readFrom(
            firstEventEntry.asEventKey(),
            Direction.Backward,
            amount
        ));
        try {
            const entries = await readerRequest.complete();
            this._remoteEntries.setManySorted(entries);
            return entries.length < amount;
        } finally {
            this._disposables.disposeTracked(readerRequest);
        }
    }

    getByEventId(eventId) {
        for (let i = 0; i < this._remoteEntries.length; i += 1) {
            const entry = this._remoteEntries.get(i);
            if (entry.id === eventId) {
                return entry;
            }
        }
    }

    /** @public */
    get entries() {
        return this._allEntries;
    }

    /**
     * @internal
     * @return {Array<EventEntry>} remote event entries, should not be modified
     */
    get remoteEntries() {
        return this._remoteEntries.array;
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
