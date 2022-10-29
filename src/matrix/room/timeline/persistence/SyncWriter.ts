/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
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

import {EventKey} from "../EventKey";
import {EventEntry} from "../entries/EventEntry";
import {FragmentBoundaryEntry} from "../entries/FragmentBoundaryEntry";
import {createEventEntry} from "./common";
import {MemberChange} from "../../members/RoomMember";
import type {FragmentIdComparer} from "../FragmentIdComparer";
import type {MemberSync, MemberWriter} from "./MemberWriter";
import type {RelationWriter} from "./RelationWriter";
import type {ILogItem} from "../../../../logging/types";
import type {Transaction} from "../../../storage/idb/Transaction";
import type {Fragment} from "../../../storage/idb/stores/TimelineFragmentStore";
import type {BaseEntry} from "../entries/BaseEntry";
import type {StateEvent,TimelineEvent} from "../../../storage/types";
import type {ClientEventWithoutRoomID, JoinedRoom, LeftRoom, Timeline} from "../../../net/types/sync";
import {MemberStateEvent, RoomEventType} from "../../../net/types/roomEvents";

// Synapse bug? where the m.room.create event appears twice in sync response
// when first syncing the room
function deduplicateEvents(events: TimelineEvent[]): TimelineEvent[] {
    const eventIds = new Set();
    return events.filter(e => {
        if (eventIds.has(e.event_id)) {
            return false;
        } else {
            eventIds.add(e.event_id);
            return true;
        }
    });
}

type Options = {roomId: string, fragmentIdComparer: FragmentIdComparer, memberWriter: MemberWriter, relationWriter: RelationWriter};

export class SyncWriter {
    private _roomId: string;
    private _fragmentIdComparer: FragmentIdComparer;
    private _memberWriter: MemberWriter;
    private _relationWriter: RelationWriter;
    private _lastLiveKey?: EventKey;

    constructor({roomId, fragmentIdComparer, memberWriter, relationWriter}: Options) {
        this._roomId = roomId;
        this._memberWriter = memberWriter;
        this._relationWriter = relationWriter;
        this._fragmentIdComparer = fragmentIdComparer;
    }

    async load(txn: Transaction, log: ILogItem): Promise<void> {
        const liveFragment = await txn.timelineFragments.liveFragment(this._roomId);
        if (liveFragment) {
            const [lastEvent] = await txn.timelineEvents.lastEvents(this._roomId, liveFragment.id, 1);
            // fall back to the default event index in case the fragment was somehow written but no events
            // we should only create fragments when really writing timeline events now
            // (see https://github.com/vector-im/hydrogen-web/issues/112) but can't hurt to be extra robust.
            const eventIndex = lastEvent ? lastEvent.eventIndex : EventKey.defaultLiveKey.eventIndex;
            this._lastLiveKey = new EventKey(liveFragment.id, eventIndex);
        }
        // if there is no live fragment, we don't create it here because load gets a readonly txn.
        // this is on purpose, load shouldn't modify the store
        if (this._lastLiveKey) {
            log.set("live key", this._lastLiveKey.toString());
        }
    }

    async _createLiveFragment(txn: Transaction, previousToken?: string): Promise<Fragment> {
        const liveFragment = await txn.timelineFragments.liveFragment(this._roomId);
        if (!liveFragment) {
            if (!previousToken) {
                previousToken = undefined;
            }
            const fragment = {
                roomId: this._roomId,
                id: EventKey.defaultLiveKey.fragmentId,
                previousId: null,
                nextId: null,
                previousToken: previousToken,
                nextToken: null
            };
            txn.timelineFragments.add(fragment);
            this._fragmentIdComparer.add(fragment);
            return fragment;
        } else {
            return liveFragment;
        }
    }

    async _replaceLiveFragment(
        oldFragmentId: number,
        newFragmentId: number,
        previousToken: string | undefined,
        txn: Transaction
    ): Promise<{ oldFragment: Fragment; newFragment: Fragment }> {
        const oldFragment = await txn.timelineFragments.get(this._roomId, oldFragmentId);
        if (!oldFragment) {
            throw new Error(`old live fragment doesn't exist: ${oldFragmentId}`);
        }
        oldFragment.nextId = newFragmentId;
        txn.timelineFragments.update(oldFragment);
        const newFragment = {
            roomId: this._roomId,
            id: newFragmentId,
            previousId: oldFragmentId,
            nextId: null,
            previousToken: previousToken,
            nextToken: null
        };
        txn.timelineFragments.add(newFragment);
        this._fragmentIdComparer.append(newFragmentId, oldFragmentId);
        return {oldFragment, newFragment};
    }

    /**
     * creates a new live fragment if the timeline is limited, or if no live fragment is created yet
     * @param  {EventKey} currentKey current key so far, might be none if room hasn't synced yet
     * @param  {Array<BaseEntrie>} entries    array to add fragment boundary entries when creating a new fragment
     * @param  {Object} timeline   timeline part of the room sync response
     * @param  {Transaction} txn        used to read and write from the fragment store
     * @return {EventKey} the new event key to start writing events at
     */
     async _ensureLiveFragment(
        currentKey: EventKey | undefined,
        entries: Array<BaseEntry>,
        timeline: Timeline,
        txn: Transaction,
        log: ILogItem
    ): Promise<EventKey> {
        if (!currentKey) {
            // means we haven't synced this room yet (just joined or did initial sync)

            // as this is probably a limited sync, prev_batch should be there
            // (but don't fail if it isn't, we won't be able to back-paginate though)
            let liveFragment = await this._createLiveFragment(txn, timeline.prev_batch);
            currentKey = new EventKey(liveFragment.id, EventKey.defaultLiveKey.eventIndex);
            entries.push(FragmentBoundaryEntry.start(liveFragment, this._fragmentIdComparer));
            log.log({l: "live fragment", first: true, id: currentKey.fragmentId});
        } else if (timeline.limited) {
            // replace live fragment for limited sync, *only* if we had a live fragment already
            const oldFragmentId = currentKey.fragmentId;
            currentKey = currentKey.nextFragmentKey();
            const {oldFragment, newFragment} = await this._replaceLiveFragment(oldFragmentId, currentKey.fragmentId, timeline.prev_batch, txn);
            entries.push(FragmentBoundaryEntry.end(oldFragment, this._fragmentIdComparer));
            entries.push(FragmentBoundaryEntry.start(newFragment, this._fragmentIdComparer));
            log.log({l: "live fragment", limited: true, id: currentKey.fragmentId});
        }
        return currentKey;
    }

    async _writeStateEvents(stateEvents: ClientEventWithoutRoomID[], txn: Transaction, log: ILogItem): Promise<void> {
        let nonMemberStateEvents = 0;
        for (const event of stateEvents) {
            // member events are written prior by MemberWriter
            if (event.type !== RoomEventType.Member) {
                txn.roomState.set(this._roomId, event as StateEvent);
                nonMemberStateEvents += 1;
            }
        }
        log.set("stateEvents", nonMemberStateEvents);
    }

    async _writeTimeline(
        timelineEvents: ClientEventWithoutRoomID[],
        timeline: Timeline | undefined,
        memberSync: MemberSync,
        currentKey: EventKey | undefined,
        txn: Transaction,
        log: ILogItem
    ): Promise<{ currentKey: EventKey | undefined; entries: EventEntry[]; updatedEntries: EventEntry[]; }> {
        const entries: EventEntry[] = [];
        const updatedEntries: EventEntry[] = [];
        if (timelineEvents?.length && timeline) {
            // only create a fragment when we will really write an event
            currentKey = await this._ensureLiveFragment(currentKey, entries, timeline, txn, log);
            log.set("timelineEvents", timelineEvents.length);
            let timelineStateEventCount = 0;
            for(const event of timelineEvents) {
                // store event in timeline
                currentKey = currentKey.nextKey();
                const storageEntry = createEventEntry(currentKey, this._roomId, event);
                let member = await memberSync.lookupMemberAtEvent(event.sender, event, txn);
                if (member) {
                    storageEntry.displayName = member.displayName;
                    storageEntry.avatarUrl = member.avatarUrl;
                }
                const couldInsert = await txn.timelineEvents.tryInsert(storageEntry, log);
                if (!couldInsert) {
                    continue;
                }
                const entry = new EventEntry(storageEntry, this._fragmentIdComparer);
                entries.push(entry);
                const updatedRelationTargetEntries = await this._relationWriter.writeRelation(entry, txn, log);
                if (updatedRelationTargetEntries) {
                    updatedEntries.push(...updatedRelationTargetEntries);
                }
                // update state events after writing event, so for a member event,
                // we only update the member info after having written the member event
                // to the timeline, as we want that event to have the old profile info.
                // member events are written prior by MemberWriter.
                if (typeof event.state_key === "string" && event.type !== RoomEventType.Member) {
                    timelineStateEventCount += 1;
                    txn.roomState.set(this._roomId, event as MemberStateEvent);
                }
            }
            log.set("timelineStateEventCount", timelineStateEventCount);
        }
        return {currentKey, entries, updatedEntries};
    }

    async _handleRejoinOverlap(
        timeline: { limited?: any; events?: any },
        txn: Transaction,
        log: ILogItem
    ): Promise<{ limited?: any; events?: any }> {
        if (this._lastLiveKey) {
            const {fragmentId} = this._lastLiveKey;
            const [lastEvent] = await txn.timelineEvents.lastEvents(this._roomId, fragmentId, 1);
            if (lastEvent) {
                const lastEventId = lastEvent.event.event_id;
                const {events} = timeline;
                const index = events.findIndex(event => event.event_id === lastEventId);
                if (index !== -1) {
                    log.set("overlap_event_id", lastEventId);
                    return Object.assign({}, timeline, {
                        limited: false,
                        events: events.slice(index + 1),
                    });
                }
            }
        }
        if (!timeline.limited) {
            log.set("force_limited_without_overlap", true);
            return Object.assign({}, timeline, {limited: true});
        }
        return timeline;
    }

    async writeSync(roomResponse: JoinedRoom | LeftRoom, isRejoin: boolean, hasFetchedMembers: boolean, txn: Transaction, log: ILogItem): Promise<SyncWriterResult> {
        let {timeline} = roomResponse;
        // we have rejoined the room after having synced it before,
        // check for overlap with the last synced event
        log.set("isRejoin", isRejoin);
        if (isRejoin) {
            timeline = await this._handleRejoinOverlap(timeline!, txn, log);
        }
        let timelineEvents: ClientEventWithoutRoomID[] = Array.isArray(timeline?.events) ? deduplicateEvents(timeline!.events) : [];
        const {state} = roomResponse;
        let stateEvents: ClientEventWithoutRoomID[] = Array.isArray(state?.events) ? state!.events : [];
        const memberSync = this._memberWriter.prepareMemberSync(stateEvents, timelineEvents, hasFetchedMembers);
        if (stateEvents) {
            await this._writeStateEvents(stateEvents, txn, log);
        }
        const {currentKey, entries, updatedEntries} =
            await this._writeTimeline(timelineEvents, timeline, memberSync, this._lastLiveKey, txn, log);
        const memberChanges = await memberSync.write(txn);
        return {entries, updatedEntries, newLiveKey: currentKey, memberChanges};
    }

    afterSync(newLiveKey: EventKey): void {
        this._lastLiveKey = newLiveKey;
    }

    get lastMessageKey(): EventKey | undefined {
        return this._lastLiveKey;
    }
}

export type SyncWriterResult = {
    entries: EventEntry[];
    updatedEntries: EventEntry[];
    newLiveKey: EventKey | undefined;
    memberChanges: Map<string, MemberChange | undefined>;
};

import {createMockStorage} from "../../../../mocks/Storage";
import {createEvent, withTextBody} from "../../../../mocks/event";
import {Instance as nullLogger} from "../../../../logging/NullLogger";
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tests() {
    const roomId = "!abc:hs.tld";
    return {
        "calling timelineEvents.tryInsert with the same event id a second time fails": async (assert): Promise<void> => {
            const storage = await createMockStorage();
            const txn = await storage.readWriteTxn([storage.storeNames.timelineEvents]);
            const event = withTextBody("hello!", createEvent("m.room.message", "$abc", "@alice:hs.tld"));
            const entry1 = createEventEntry(EventKey.defaultLiveKey, roomId, event);
            assert.equal(await txn.timelineEvents.tryInsert(entry1, nullLogger.item), true);
            const entry2 = createEventEntry(EventKey.defaultLiveKey.nextKey(), roomId, event);
            assert.equal(await txn.timelineEvents.tryInsert(entry2, nullLogger.item), false);
            // fake-indexeddb still aborts the transaction when preventDefault is called by tryInsert, so don't await as it will abort
            // await txn.complete();
        },
        "calling timelineEvents.tryInsert with the same event key a second time fails": async (assert): Promise<void>=> {
            const storage = await createMockStorage();
            const txn = await storage.readWriteTxn([storage.storeNames.timelineEvents]);
            const event1 = withTextBody("hello!", createEvent("m.room.message", "$abc", "@alice:hs.tld"));
            const entry1 = createEventEntry(EventKey.defaultLiveKey, roomId, event1);
            assert.equal(await txn.timelineEvents.tryInsert(entry1, nullLogger.item), true);
            const event2 = withTextBody("hello!", createEvent("m.room.message", "$def", "@alice:hs.tld"));
            const entry2 = createEventEntry(EventKey.defaultLiveKey, roomId, event2);
            assert.equal(await txn.timelineEvents.tryInsert(entry2, nullLogger.item), false);
            // fake-indexeddb still aborts the transaction when preventDefault is called by tryInsert, so don't await as it will abort
            // await txn.complete();
        },
    };
}
