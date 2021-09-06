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

import {EventKey} from "../../../room/timeline/EventKey";
import { StorageError } from "../../common";
import { encodeUint32 } from "../utils";
import {KeyLimits} from "../../common";
import {Store} from "../Store";
import {TimelineEvent, StateEvent} from "../../types";

interface Annotation {
    count: number;
    me: boolean;
    firstTimestamp: number;
}

interface TimelineEventEntry {
    roomId: string;
    fragmentId: number;
    eventIndex: number;
    event: TimelineEvent | StateEvent;
    displayName?: string;
    avatarUrl?: string;
    annotations?: { [key : string]: Annotation };
}

type TimelineEventStorageEntry = TimelineEventEntry & { key: string, eventIdKey: string };

function encodeKey(roomId: string, fragmentId: number, eventIndex: number): string {
    return `${roomId}|${encodeUint32(fragmentId)}|${encodeUint32(eventIndex)}`;
}

function encodeEventIdKey(roomId: string, eventId: string): string {
    return `${roomId}|${eventId}`;
}

function decodeEventIdKey(eventIdKey: string): { roomId: string, eventId: string } {
    const [roomId, eventId] = eventIdKey.split("|");
    return {roomId, eventId};
}

class Range {
    private _IDBKeyRange: typeof IDBKeyRange;
    private _only?: EventKey;
    private _lower?: EventKey;
    private _upper?: EventKey;
    private _lowerOpen: boolean;
    private _upperOpen: boolean;

    constructor(_IDBKeyRange: any, only?: EventKey, lower?: EventKey, upper?: EventKey, lowerOpen: boolean = false, upperOpen: boolean = false) {
        this._IDBKeyRange = _IDBKeyRange;
        this._only = only;
        this._lower = lower;
        this._upper = upper;
        this._lowerOpen = lowerOpen;
        this._upperOpen = upperOpen;
    }

    asIDBKeyRange(roomId: string): IDBKeyRange | undefined {
        try {
            // only
            if (this._only) {
                return this._IDBKeyRange.only(encodeKey(roomId, this._only.fragmentId, this._only.eventIndex));
            }
            // lowerBound
            // also bound as we don't want to move into another roomId
            if (this._lower && !this._upper) {
                return this._IDBKeyRange.bound(
                    encodeKey(roomId, this._lower.fragmentId, this._lower.eventIndex),
                    encodeKey(roomId, this._lower.fragmentId, KeyLimits.maxStorageKey),
                    this._lowerOpen,
                    false
                );
            }
            // upperBound
            // also bound as we don't want to move into another roomId
            if (!this._lower && this._upper) {
                return this._IDBKeyRange.bound(
                    encodeKey(roomId, this._upper.fragmentId, KeyLimits.minStorageKey),
                    encodeKey(roomId, this._upper.fragmentId, this._upper.eventIndex),
                    false,
                    this._upperOpen
                );
            }
            // bound
            if (this._lower && this._upper) {
                return this._IDBKeyRange.bound(
                    encodeKey(roomId, this._lower.fragmentId, this._lower.eventIndex),
                    encodeKey(roomId, this._upper.fragmentId, this._upper.eventIndex),
                    this._lowerOpen,
                    this._upperOpen
                );
            }
        } catch(err) {
            throw new StorageError(`IDBKeyRange failed with data: ` + JSON.stringify(this), err);
        }
    }
}
/*
 * @typedef   {Object} Gap
 * @property  {?string} prev_batch the pagination token for this backwards facing gap
 * @property  {?string} next_batch the pagination token for this forwards facing gap
 *
 * @typedef   {Object} Event
 * @property  {string} event_id the id of the event
 * @property  {string} type the
 * @property  {?string} state_key the state key of this state event
 *
 * @typedef   {Object} Entry
 * @property  {string} roomId
 * @property  {EventKey} eventKey
 * @property  {?Event} event if an event entry, the event
 * @property  {?Gap} gap if a gap entry, the gap
*/
export class TimelineEventStore {
    private _timelineStore: Store<TimelineEventStorageEntry>;

    constructor(timelineStore: Store<TimelineEventStorageEntry>) {
        this._timelineStore = timelineStore;
    }

    /** Creates a range that only includes the given key
     *  @param eventKey the key
     *  @return the created range
     */
    onlyRange(eventKey: EventKey): Range {
        return new Range(this._timelineStore.IDBKeyRange, eventKey);
    }

    /** Creates a range that includes all keys before eventKey, and optionally also the key itself.
     *  @param eventKey the key
     *  @param [open=false] whether the key is included (false) or excluded (true) from the range at the upper end.
     *  @return the created range
     */
    upperBoundRange(eventKey: EventKey, open=false): Range {
        return new Range(this._timelineStore.IDBKeyRange, undefined, undefined, eventKey, undefined, open);
    }

    /** Creates a range that includes all keys after eventKey, and optionally also the key itself.
     *  @param eventKey the key
     *  @param [open=false] whether the key is included (false) or excluded (true) from the range at the lower end.
     *  @return the created range
     */
    lowerBoundRange(eventKey: EventKey, open=false): Range {
        return new Range(this._timelineStore.IDBKeyRange, undefined, eventKey, undefined, open);
    }

    /** Creates a range that includes all keys between `lower` and `upper`, and optionally the given keys as well.
     *  @param lower the lower key
     *  @param upper the upper key
     *  @param [lowerOpen=false] whether the lower key is included (false) or excluded (true) from the range.
     *  @param [upperOpen=false] whether the upper key is included (false) or excluded (true) from the range.
     *  @return the created range
     */
    boundRange(lower: EventKey, upper: EventKey, lowerOpen=false, upperOpen=false): Range {
        return new Range(this._timelineStore.IDBKeyRange, undefined, lower, upper, lowerOpen, upperOpen);
    }

    /** Looks up the last `amount` entries in the timeline for `roomId`.
     *  @param roomId
     *  @param fragmentId
     *  @param amount
     *  @return a promise resolving to an array with 0 or more entries, in ascending order.
     */
    async lastEvents(roomId: string, fragmentId: number, amount: number): Promise<TimelineEventEntry[]> {
        const eventKey = EventKey.maxKey;
        eventKey.fragmentId = fragmentId;
        return this.eventsBefore(roomId, eventKey, amount);
    }

    /** Looks up the first `amount` entries in the timeline for `roomId`.
     *  @param roomId
     *  @param fragmentId
     *  @param amount
     *  @return a promise resolving to an array with 0 or more entries, in ascending order.
     */
    async firstEvents(roomId: string, fragmentId: number, amount: number): Promise<TimelineEventEntry[]> {
        const eventKey = EventKey.minKey;
        eventKey.fragmentId = fragmentId;
        return this.eventsAfter(roomId, eventKey, amount);
    }

    /** Looks up `amount` entries after `eventKey` in the timeline for `roomId` within the same fragment.
     *  The entry for `eventKey` is not included.
     *  @param roomId
     *  @param eventKey
     *  @param amount
     *  @return a promise resolving to an array with 0 or more entries, in ascending order.
     */
    eventsAfter(roomId: string, eventKey: EventKey, amount: number): Promise<TimelineEventEntry[]> {
        const idbRange = this.lowerBoundRange(eventKey, true).asIDBKeyRange(roomId);
        return this._timelineStore.selectLimit(idbRange, amount);
    }

    /** Looks up `amount` entries before `eventKey` in the timeline for `roomId` within the same fragment.
     *  The entry for `eventKey` is not included.
     *  @param roomId
     *  @param eventKey
     *  @param amount
     *  @return a promise resolving to an array with 0 or more entries, in ascending order.
     */
    async eventsBefore(roomId: string, eventKey: EventKey, amount: number): Promise<TimelineEventEntry[]> {
        const range = this.upperBoundRange(eventKey, true).asIDBKeyRange(roomId);
        const events = await this._timelineStore.selectLimitReverse(range, amount);
        events.reverse(); // because we fetched them backwards
        return events;
    }

    /** Finds the first eventId that occurs in the store, if any.
     *  For optimal performance, `eventIds` should be in chronological order.
     *
     *  The order in which results are returned might be different than `eventIds`.
     *  Call the return value to obtain the next {id, event} pair.
     *  @param roomId
     *  @param eventIds
     *  @return
     */
    // performance comment from above refers to the fact that there *might*
    // be a correlation between event_id sorting order and chronology.
    // In that case we could avoid running over all eventIds, as the reported order by findExistingKeys
    // would match the order of eventIds. That's why findLast is also passed as backwards to keysExist.
    // also passing them in chronological order makes sense as that's how we'll receive them almost always.
    async findFirstOccurringEventId(roomId: string, eventIds: string[]): Promise<string | undefined> {
        const byEventId = this._timelineStore.index("byEventId");
        const keys = eventIds.map(eventId => encodeEventIdKey(roomId, eventId));
        const results = new Array(keys.length);
        let firstFoundKey: string | undefined;

        // find first result that is found and has no undefined results before it
        function firstFoundAndPrecedingResolved(): string | undefined {
            for(let i = 0; i < results.length; ++i) {
                if (results[i] === undefined) {
                    return;
                } else if(results[i] === true) {
                    return keys[i];
                }
            }
        }

        await byEventId.findExistingKeys(keys, false, (key, found) => {
            // T[].search(T, number), but we want T[].search(R, number), so cast
            const index = (keys as IDBValidKey[]).indexOf(key);
            results[index] = found;
            firstFoundKey = firstFoundAndPrecedingResolved();
            return !!firstFoundKey;
        });
        return firstFoundKey && decodeEventIdKey(firstFoundKey).eventId;
    }

    /** Inserts a new entry into the store. The combination of roomId and eventKey should not exist yet, or an error is thrown.
     *  @param entry the entry to insert
     *  @return nothing. To wait for the operation to finish, await the transaction it's part of.
     *  @throws {StorageError} ...
     */
    insert(entry: TimelineEventEntry): void {
        (entry as TimelineEventStorageEntry).key = encodeKey(entry.roomId, entry.fragmentId, entry.eventIndex);
        (entry as TimelineEventStorageEntry).eventIdKey = encodeEventIdKey(entry.roomId, entry.event.event_id);
        // TODO: map error? or in idb/store?
        this._timelineStore.add(entry as TimelineEventStorageEntry);
    }

    /** Updates the entry into the store with the given [roomId, eventKey] combination.
     *  If not yet present, will insert. Might be slower than add.
     *  @param entry the entry to update.
     *  @return nothing. To wait for the operation to finish, await the transaction it's part of.
     */
    update(entry: TimelineEventEntry): void {
        this._timelineStore.put(entry as TimelineEventStorageEntry);
    }

    get(roomId: string, eventKey: EventKey): Promise<TimelineEventEntry | null> {
        return this._timelineStore.get(encodeKey(roomId, eventKey.fragmentId, eventKey.eventIndex));
    }

    getByEventId(roomId: string, eventId: string): Promise<TimelineEventEntry | null> {
        return this._timelineStore.index("byEventId").get(encodeEventIdKey(roomId, eventId));
    }

    removeAllForRoom(roomId: string): void {
        const minKey = encodeKey(roomId, KeyLimits.minStorageKey, KeyLimits.minStorageKey);
        const maxKey = encodeKey(roomId, KeyLimits.maxStorageKey, KeyLimits.maxStorageKey);
        const range = this._timelineStore.IDBKeyRange.bound(minKey, maxKey);
        this._timelineStore.delete(range);
    }
}
