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

import {SortKey} from "../../room/timeline/SortKey.js";
import {sortedIndex} from "../../../utils/sortedIndex.js";
import {Store} from "./Store.js";

function compareKeys(key, entry) {
    if (key.roomId === entry.roomId) {
        return key.sortKey.compare(entry.sortKey);
    } else {
        return key.roomId < entry.roomId ? -1 : 1;
    }
}

class Range {
    constructor(timeline, lower, upper, lowerOpen, upperOpen) {
        this._timeline = timeline;
        this._lower = lower;
        this._upper = upper;
        this._lowerOpen = lowerOpen;
        this._upperOpen = upperOpen;
    }

    /** projects the range onto the timeline array */
    project(roomId, maxCount = Number.MAX_SAFE_INTEGER) {
        // determine lowest and highest allowed index.
        // Important not to bleed into other roomIds here.
        const lowerKey = {roomId, sortKey: this._lower || SortKey.minKey };
        // apply lower key being open (excludes given key)
        let minIndex = sortedIndex(this._timeline, lowerKey, compareKeys);
        if (this._lowerOpen && minIndex < this._timeline.length && compareKeys(lowerKey, this._timeline[minIndex]) === 0) {
            minIndex += 1;
        }
        const upperKey = {roomId, sortKey: this._upper || SortKey.maxKey };
        // apply upper key being open (excludes given key)
        let maxIndex = sortedIndex(this._timeline, upperKey, compareKeys);
        if (this._upperOpen && maxIndex < this._timeline.length && compareKeys(upperKey, this._timeline[maxIndex]) === 0) {
            maxIndex -= 1;
        }
        // find out from which edge we should grow
        // if upper or lower bound
        // again, important not to go below minIndex or above maxIndex
        // to avoid bleeding into other rooms
        let startIndex, endIndex;
        if (!this._lower && this._upper) {
            startIndex = Math.max(minIndex, maxIndex - maxCount);
            endIndex = maxIndex;
        } else if (this._lower && !this._upper) {
            startIndex = minIndex;
            endIndex = Math.min(maxIndex, minIndex + maxCount);
        } else {
            startIndex = minIndex;
            endIndex = maxIndex;
        }
        
        // if startIndex is out of range, make range empty
        if (startIndex === this._timeline.length) {
            startIndex = endIndex = 0;
        }
        const count = endIndex - startIndex;
        return {startIndex, count};
    }

    select(roomId, maxCount) {
        const {startIndex, count} = this.project(roomId, this._timeline, maxCount);
        return this._timeline.slice(startIndex, startIndex + count);
    }
}

export class RoomTimelineStore extends Store {
    constructor(timeline, writable) {
        super(timeline || [], writable);
    }

    get _timeline() {
        return this._storeValue;
    }

    /** Creates a range that only includes the given key
     *  @param {SortKey} sortKey the key
     *  @return {Range} the created range
     */
    onlyRange(sortKey) {
        return new Range(this._timeline, sortKey, sortKey);
    }

    /** Creates a range that includes all keys before sortKey, and optionally also the key itself.
     *  @param {SortKey} sortKey the key
     *  @param {boolean} [open=false] whether the key is included (false) or excluded (true) from the range at the upper end.
     *  @return {Range} the created range
     */
    upperBoundRange(sortKey, open=false) {
        return new Range(this._timeline, undefined, sortKey, undefined, open);
    }

    /** Creates a range that includes all keys after sortKey, and optionally also the key itself.
     *  @param {SortKey} sortKey the key
     *  @param {boolean} [open=false] whether the key is included (false) or excluded (true) from the range at the lower end.
     *  @return {Range} the created range
     */
    lowerBoundRange(sortKey, open=false) {
        return new Range(this._timeline, sortKey, undefined, open);
    }

    /** Creates a range that includes all keys between `lower` and `upper`, and optionally the given keys as well.
     *  @param {SortKey} lower the lower key
     *  @param {SortKey} upper the upper key
     *  @param {boolean} [lowerOpen=false] whether the lower key is included (false) or excluded (true) from the range.
     *  @param {boolean} [upperOpen=false] whether the upper key is included (false) or excluded (true) from the range.
     *  @return {Range} the created range
     */
    boundRange(lower, upper, lowerOpen=false, upperOpen=false) {
        return new Range(this._timeline, lower, upper, lowerOpen, upperOpen);
    }

    /** Looks up the last `amount` entries in the timeline for `roomId`.
     *  @param  {string} roomId
     *  @param  {number} amount
     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
     */
    lastEvents(roomId, amount) {
        return this.eventsBefore(roomId, SortKey.maxKey, amount);
    }

    /** Looks up the first `amount` entries in the timeline for `roomId`.
     *  @param  {string} roomId
     *  @param  {number} amount
     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
     */
    firstEvents(roomId, amount) {
        return this.eventsAfter(roomId, SortKey.minKey, amount);
    }

    /** Looks up `amount` entries after `sortKey` in the timeline for `roomId`.
     *  The entry for `sortKey` is not included.
     *  @param  {string} roomId
     *  @param  {SortKey} sortKey
     *  @param  {number} amount
     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
     */
    eventsAfter(roomId, sortKey, amount) {
        const events = this.lowerBoundRange(sortKey, true).select(roomId, amount);
        return Promise.resolve(events);
    }

    /** Looks up `amount` entries before `sortKey` in the timeline for `roomId`.
     *  The entry for `sortKey` is not included.
     *  @param  {string} roomId
     *  @param  {SortKey} sortKey
     *  @param  {number} amount
     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
     */
    eventsBefore(roomId, sortKey, amount) {
        const events = this.upperBoundRange(sortKey, true).select(roomId, amount);
        return Promise.resolve(events);
    }

    /** Looks up the first, if any, event entry (so excluding gap entries) after `sortKey`.
     *  @param  {string} roomId
     *  @param  {SortKey} sortKey
     *  @return {Promise<(?Entry)>} a promise resolving to entry, if any.
     */
    nextEvent(roomId, sortKey) {
        const searchSpace = this.lowerBoundRange(sortKey, true).select(roomId);
        const event = searchSpace.find(entry => !!entry.event);
        return Promise.resolve(event);
    }

    /** Looks up the first, if any, event entry (so excluding gap entries) before `sortKey`.
     *  @param  {string} roomId
     *  @param  {SortKey} sortKey
     *  @return {Promise<(?Entry)>} a promise resolving to entry, if any.
     */
    previousEvent(roomId, sortKey) {
        const searchSpace = this.upperBoundRange(sortKey, true).select(roomId);
        const event = searchSpace.reverse().find(entry => !!entry.event);
        return Promise.resolve(event);
    }

    /** Inserts a new entry into the store. The combination of roomId and sortKey should not exist yet, or an error is thrown.
     *  @param  {Entry} entry the entry to insert
     *  @return {Promise<>} a promise resolving to undefined if the operation was successful, or a StorageError if not.
     *  @throws {StorageError} ...
     */
    insert(entry) {
        this.assertWritable();
        const insertIndex = sortedIndex(this._timeline, entry, compareKeys);
        if (insertIndex < this._timeline.length) {
            const existingEntry = this._timeline[insertIndex];
            if (compareKeys(entry, existingEntry) === 0) {
                return Promise.reject(new Error("entry already exists"));
            }
        }
        this._timeline.splice(insertIndex, 0, entry);
        return Promise.resolve();
    }

    /** Updates the entry into the store with the given [roomId, sortKey] combination.
     *  If not yet present, will insert. Might be slower than add.
     *  @param  {Entry} entry the entry to update.
     *  @return {Promise<>} a promise resolving to undefined if the operation was successful, or a StorageError if not.
     */
    update(entry) {
        this.assertWritable();
        let update = false;
        const updateIndex = sortedIndex(this._timeline, entry, compareKeys);
        if (updateIndex < this._timeline.length) {
            const existingEntry = this._timeline[updateIndex];
            if (compareKeys(entry, existingEntry) === 0) {
                update = true;
            }
        }
        this._timeline.splice(updateIndex, update ? 1 : 0, entry);
        return Promise.resolve();
    }

    get(roomId, sortKey) {
        const range = this.onlyRange(sortKey);
        const {startIndex, count} = range.project(roomId);
        const event = count ? this._timeline[startIndex] : undefined;
        return Promise.resolve(event);
    }
}
