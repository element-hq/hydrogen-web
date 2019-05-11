import SortKey from "../../../room/timeline/SortKey.js";

class Range {
    constructor(only, lower, upper, lowerOpen, upperOpen) {
        this._only = only;
        this._lower = lower;
        this._upper = upper;
        this._lowerOpen = lowerOpen;
        this._upperOpen = upperOpen;
    }

    asIDBKeyRange(roomId) {
        // only
        if (this._only) {
            return IDBKeyRange.only([roomId, this._only.buffer]);
        }
        // lowerBound
        // also bound as we don't want to move into another roomId
        if (this._lower && !this._upper) {
            return IDBKeyRange.bound(
                [roomId, this._lower.buffer],
                [roomId, SortKey.maxKey.buffer],
                this._lowerOpen,
                false
            );
        }
        // upperBound
        // also bound as we don't want to move into another roomId
        if (!this._lower && this._upper) {
            return IDBKeyRange.bound(
                [roomId, SortKey.minKey.buffer],
                [roomId, this._upper.buffer],
                false,
                this._upperOpen
            );
        }
        // bound
        if (this._lower && this._upper) {
            return IDBKeyRange.bound(
                [roomId, this._lower.buffer],
                [roomId, this._upper.buffer],
                this._lowerOpen,
                this._upperOpen
            );
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
 * @property  {SortKey} sortKey
 * @property  {?Event} event if an event entry, the event
 * @property  {?Gap} gap if a gap entry, the gap
*/
export default class RoomTimelineStore {
	constructor(timelineStore) {
		this._timelineStore = timelineStore;
	}

    /** Creates a range that only includes the given key
     *  @param {SortKey} sortKey the key
     *  @return {Range} the created range
     */
    onlyRange(sortKey) {
        return new Range(sortKey);
    }

    /** Creates a range that includes all keys before sortKey, and optionally also the key itself.
     *  @param {SortKey} sortKey the key
     *  @param {boolean} [open=false] whether the key is included (false) or excluded (true) from the range at the upper end.
     *  @return {Range} the created range
     */
    upperBoundRange(sortKey, open=false) {
        return new Range(undefined, undefined, sortKey, undefined, open);
    }

    /** Creates a range that includes all keys after sortKey, and optionally also the key itself.
     *  @param {SortKey} sortKey the key
     *  @param {boolean} [open=false] whether the key is included (false) or excluded (true) from the range at the lower end.
     *  @return {Range} the created range
     */
    lowerBoundRange(sortKey, open=false) {
        return new Range(undefined, sortKey, undefined, open);
    }

    /** Creates a range that includes all keys between `lower` and `upper`, and optionally the given keys as well.
     *  @param {SortKey} lower the lower key
     *  @param {SortKey} upper the upper key
     *  @param {boolean} [lowerOpen=false] whether the lower key is included (false) or excluded (true) from the range.
     *  @param {boolean} [upperOpen=false] whether the upper key is included (false) or excluded (true) from the range.
     *  @return {Range} the created range
     */
    boundRange(lower, upper, lowerOpen=false, upperOpen=false) {
        return new Range(undefined, lower, upper, lowerOpen, upperOpen);
    }

    /** Looks up the last `amount` entries in the timeline for `roomId`.
     *  @param  {string} roomId
     *  @param  {number} amount
     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
     */
	async lastEvents(roomId, amount) {
		return this.eventsBefore(roomId, SortKey.maxKey, amount);
	}

    /** Looks up the first `amount` entries in the timeline for `roomId`.
     *  @param  {string} roomId
     *  @param  {number} amount
     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
     */
	async firstEvents(roomId, amount) {
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
        const idbRange = this.lowerBoundRange(sortKey, true).asIDBKeyRange(roomId);
		return this._timelineStore.selectLimit(idbRange, amount);
	}

    /** Looks up `amount` entries before `sortKey` in the timeline for `roomId`.
     *  The entry for `sortKey` is not included.
     *  @param  {string} roomId
     *  @param  {SortKey} sortKey
     *  @param  {number} amount
     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
     */
    async eventsBefore(roomId, sortKey, amount) {
        const range = this.upperBoundRange(sortKey, true).asIDBKeyRange(roomId);
        const events = await this._timelineStore.selectLimitReverse(range, amount);
        events.reverse(); // because we fetched them backwards
        return events;
    }

    /** Finds the first (or last if `findLast=true`) eventId that occurs in the store, if any.
     *  For optimal performance, `eventIds` should be in chronological order.
     *
     *  The order in which results are returned might be different than `eventIds`.
     *  Call the return value to obtain the next {id, event} pair.
     *  @param  {string} roomId
     *  @param  {string[]} eventIds
     *  @return {Function<Promise>}
     */
    // performance comment from above refers to the fact that their *might*
    // be a correlation between event_id sorting order and chronology.
    // In that case we could avoid running over all eventIds, as the reported order by findExistingKeys
    // would match the order of eventIds. That's why findLast is also passed as backwards to keysExist.
    // also passing them in chronological order makes sense as that's how we'll receive them almost always.
    async findFirstOrLastOccurringEventId(roomId, eventIds, findLast = false) {
        const byEventId = this._timelineStore.index("byEventId");
        const keys = eventIds.map(eventId => [roomId, eventId]);
        const results = new Array(keys.length);
        let firstFoundEventId;

        // find first result that is found and has no undefined results before it
        function firstFoundAndPrecedingResolved() {
            let inc = findLast ? -1 : 1;
            let start = findLast ? results.length - 1 : 0;
            for(let i = start; i >= 0 && i < results.length; i += inc) {
                if (results[i] === undefined) {
                    return;
                } else if(results[i] === true) {
                    return keys[i];
                }
            }
        }

        await byEventId.findExistingKeys(keys, findLast, (key, found) => {
            const index = keys.indexOf(key);
            results[index] = found;
            firstFoundEventId = firstFoundAndPrecedingResolved();
            return !!firstFoundEventId;
        });

        return firstFoundEventId;
    }

    /** Inserts a new entry into the store. The combination of roomId and sortKey should not exist yet, or an error is thrown.
     *  @param  {Entry} entry the entry to insert
     *  @return {Promise<>} a promise resolving to undefined if the operation was successful, or a StorageError if not.
     *  @throws {StorageError} ...
     */
    insert(entry) {
        // TODO: map error? or in idb/store?
        return this._timelineStore.add(entry);
    }

    /** Updates the entry into the store with the given [roomId, sortKey] combination.
     *  If not yet present, will insert. Might be slower than add.
     *  @param  {Entry} entry the entry to update.
     *  @return {Promise<>} a promise resolving to undefined if the operation was successful, or a StorageError if not.
     */
    update(entry) {
        return this._timelineStore.put(entry);
    }

    get(roomId, sortKey) {
        return this._timelineStore.get([roomId, sortKey]);
    }
    // returns the entries as well!! (or not always needed? I guess not always needed, so extra method)
    removeRange(roomId, range) {
        // TODO: read the entries!
        return this._timelineStore.delete(range.asIDBKeyRange(roomId));
    }
}
