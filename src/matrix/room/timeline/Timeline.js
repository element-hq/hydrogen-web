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
import {PowerLevels} from "./PowerLevels.js";

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
        this._powerLevels = null;
    }

    /** @package */
    async load(user, membership, log) {
        const txn = await this._storage.readTxn(this._timelineReader.readTxnStores.concat(
            this._storage.storeNames.roomMembers,
            this._storage.storeNames.roomState
        ));
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

        this._powerLevels = await this._loadPowerLevels(txn);
        // 30 seems to be a good amount to fill the entire screen
        const readerRequest = this._disposables.track(this._timelineReader.readFromEnd(30, txn, log));
        try {
            const entries = await readerRequest.complete();
            this._setupEntries(entries);
        } finally {
            this._disposables.disposeTracked(readerRequest);
        }
        // txn should be assumed to have finished here, as decryption will close it.
    }

    async _loadPowerLevels(txn) {
        // TODO: update power levels as state is updated
        const powerLevelsState = await txn.roomState.get(this._roomId, "m.room.power_levels", "");
        if (powerLevelsState) {
            return new PowerLevels({
                powerLevelEvent: powerLevelsState.event,
                ownUserId: this._ownMember.userId
            });
        }
        const createState = await txn.roomState.get(this._roomId, "m.room.create", "");
        if (createState) {
            return new PowerLevels({
                createEvent: createState.event,
                ownUserId: this._ownMember.userId
            });
        } else {
            return new PowerLevels({ownUserId: this._ownMember.userId});
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
        } else {
            this._localEntries = new ObservableArray();
        }
        this._allEntries = new ConcatList(this._remoteEntries, this._localEntries);
    }

    _applyAndEmitLocalRelationChange(pe, updater) {
        const updateOrFalse = e => {
            const params = updater(e);
            return params ? params : false;
        };
        // first, look in local entries based on txn id
        if (pe.relatedTxnId) {
            const found = this._localEntries.findAndUpdate(
                e => e.id === pe.relatedTxnId,
                updateOrFalse,
            );
            if (found) {
                return;
            }
        }
        // now look in remote entries based on event id
        if (pe.relatedEventId) {
            this._remoteEntries.findAndUpdate(
                e => e.id === pe.relatedEventId,
                updateOrFalse
            );
        }
    }

    updateOwnMember(member) {
        this._ownMember = member;
    }

    replaceEntries(entries) {
        this._addLocalRelationsToNewRemoteEntries(entries);
        for (const entry of entries) {
            this._remoteEntries.update(entry);
        }
    }

    _addLocalRelationsToNewRemoteEntries(entries) {
        // because it is not safe to iterate a derived observable collection
        // before it has any subscriptions, we bail out if this isn't
        // the case yet. This can happen when sync adds or replaces entries
        // before load has finished and the view has subscribed to the timeline.
        // 
        // Once the subscription is setup, MappedList will set up the local
        // relations as needed with _applyAndEmitLocalRelationChange,
        // so we're not missing anything by bailing out.
        if (!this._localEntries.hasSubscriptions) {
            return;
        }
        // find any local relations to this new remote event
        for (const pee of this._localEntries) {
            // this will work because we set relatedEventId when removing remote echos
            if (pee.relatedEventId) {
                const relationTarget = entries.find(e => e.id === pee.relatedEventId);
                // no need to emit here as this entry is about to be added
                relationTarget?.addLocalRelation(pee);
            }
        }
    }

    /** @package */
    addOrReplaceEntries(newEntries) {
        this._addLocalRelationsToNewRemoteEntries(newEntries);
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

    /** @internal */
    enableEncryption(decryptEntries) {
        this._timelineReader.enableEncryption(decryptEntries);
    }

    get powerLevels() {
        return this._powerLevels;
    }

    get me() {
        return this._ownMember;
    }
}

import {FragmentIdComparer} from "./FragmentIdComparer.js";
import {Clock as MockClock} from "../../../mocks/Clock.js";
import {createMockStorage} from "../../../mocks/Storage.js";
import {createEvent, withTextBody, withSender} from "../../../mocks/event.js";
import {NullLogItem} from "../../../logging/NullLogger.js";
import {EventEntry} from "./entries/EventEntry.js";
import {User} from "../../User.js";
import {PendingEvent} from "../sending/PendingEvent.js";

export function tests() {
    const fragmentIdComparer = new FragmentIdComparer([]);
    const roomId = "$abc";
    return {
        "adding or replacing entries before subscribing to entries does not loose local relations": async assert => {
            const pendingEvents = new ObservableArray();
            const timeline = new Timeline({
                roomId,
                storage: await createMockStorage(),
                closeCallback: () => {},
                fragmentIdComparer,
                pendingEvents,
                clock: new MockClock(),
            });
            // 1. load timeline
            await timeline.load(new User("@alice:hs.tld"), "join", new NullLogItem());
            // 2. test replaceEntries and addOrReplaceEntries don't fail
            const event1 = withTextBody("hi!", withSender("@bob:hs.tld", createEvent("m.room.message", "!abc")));
            const entry1 = new EventEntry({event: event1, fragmentId: 1, eventIndex: 1}, fragmentIdComparer);
            timeline.replaceEntries([entry1]);
            const event2 = withTextBody("hi bob!", withSender("@alice:hs.tld", createEvent("m.room.message", "!def")));
            const entry2 = new EventEntry({event: event2, fragmentId: 1, eventIndex: 2}, fragmentIdComparer);
            timeline.addOrReplaceEntries([entry2]);
            // 3. add local relation (redaction)
            pendingEvents.append(new PendingEvent({data: {
                roomId,
                queueIndex: 1,
                eventType: "m.room.redaction",
                txnId: "t123",
                content: {},
                relatedEventId: event2.event_id
            }}));
            // 4. subscribe (it's now safe to iterate timeline.entries)
            timeline.entries.subscribe({});
            // 5. check the local relation got correctly aggregated
            assert.equal(Array.from(timeline.entries)[0].isRedacting, true);
        }
    }
}