/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {SortedArray, MappedList, ConcatList, ObservableArray} from "../../../observable/index.js";
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
        this._pendingEvents = pendingEvents;
        this._clock = clock;
        this._remoteEntries = null;
        this._ownMember = null;
        this._timelineReader = new TimelineReader({
            roomId: this._roomId,
            storage: this._storage,
            fragmentIdComparer: this._fragmentIdComparer
        });
        this._readerRequest = null;
        this._allEntries = null;
    }

    /** @package */
    async load(user, membership, log) {
        const txn = await this._storage.readTxn(this._timelineReader.readTxnStores.concat(this._storage.storeNames.roomMembers));
        const memberData = await txn.roomMembers.get(this._roomId, user.id);
        if (memberData) {
            this._ownMember = new RoomMember(memberData);
        } else {
            // this should never happen, as our own join into the room would have
            // made us receive our own member event, but just to be on the safe side and not crash,
            // fall back to bare user id
            this._ownMember = RoomMember.fromUserId(this._roomId, user.id, membership);
        }
        // it should be fine to not update the local entries,
        // as they should only populate once the view subscribes to it
        // if they are populated already, the sender profile would be empty

        // 30 seems to be a good amount to fill the entire screen
        const readerRequest = this._disposables.track(this._timelineReader.readFromEnd(30, txn, log));
        try {
            const entries = await readerRequest.complete();
            this._setupEntries(entries);
        } finally {
            this._disposables.disposeTracked(readerRequest);
        }
    }

    _setupEntries(timelineEntries) {
        this._remoteEntries = new SortedArray((a, b) => a.compare(b));
        this._remoteEntries.setManySorted(timelineEntries);
        if (this._pendingEvents) {
            this._localEntries = new MappedList(this._pendingEvents, pe => {
                const pee = new PendingEventEntry({pendingEvent: pe, member: this._ownMember, clock: this._clock});
                this._applyAndEmitLocalRelationChange(pee.pendingEvent, target => target.addLocalRelation(pee));
                return pee;
            }, (pee, params) => {
                // is sending but redacted, who do we detect that here to remove the relation?
                pee.notifyUpdate(params);
            }, pee => {
                this._applyAndEmitLocalRelationChange(pee.pendingEvent, target => target.removeLocalRelation(pee));
            });
            // we need a hook for when a pee is removed, so we can remove the local relation
        } else {
            this._localEntries = new ObservableArray();
        }
        this._allEntries = new ConcatList(this._remoteEntries, this._localEntries);
    }

    _applyAndEmitLocalRelationChange(pe, updater) {
        // first, look in local entries (separately, as it has its own update mechanism)
        const foundInLocalEntries = this._localEntries.findAndUpdate(
            e => e.id === pe.relatedTxnId,
            e => {
                const params = updater(e);
                return params ? params : false;
            },
        );
        // now look in remote entries
        if (!foundInLocalEntries && pe.relatedEventId) {
            // TODO: ideally iterate in reverse as target is likely to be most recent,
            // but not easy through ObservableList contract
            for (const entry of this._allEntries) {
                if (pe.relatedEventId === entry.id) {
                    const params = updater(entry);
                    if (params) {
                        this._remoteEntries.update(entry, params);
                    }
                    return;
                }
            }
        }
    }

    updateOwnMember(member) {
        this._ownMember = member;
    }

    replaceEntries(entries) {
        for (const entry of entries) {
            // this will use the comparator and thus
            // check for equality using the compare method in BaseEntry
            this._remoteEntries.findAndUpdate(entry, (previousEntry, entry) => {
                entry.transferLocalEchoState(previousEntry);
            });
        }
    }

    /** @package */
    addOrReplaceEntries(newEntries) {
        // find any local relations to this new remote event
        for (const pee of this._localEntries) {
            // this will work because we set relatedEventId when removing remote echos
            if (pee.relatedEventId) {
                const relationTarget = newEntries.find(e => e.id === pee.relatedEventId);
                // no need to emit here as this entry is about to be added
                relationTarget?.addLocalRelation(pee);
            }
        }
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
            this.addOrReplaceEntries(entries);
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
        return null;
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
