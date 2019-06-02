import EventKey from "../../../room/timeline/EventKey.js";

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
            return IDBKeyRange.only([roomId, this._only.fragmentId, this._only.eventIndex]);
        }
        // lowerBound
        // also bound as we don't want to move into another roomId
        if (this._lower && !this._upper) {
            return IDBKeyRange.bound(
                [roomId, this._lower.fragmentId, this._lower.eventIndex],
                [roomId, this._lower.fragmentId, EventKey.maxKey.eventIndex],
                this._lowerOpen,
                false
            );
        }
        // upperBound
        // also bound as we don't want to move into another roomId
        if (!this._lower && this._upper) {
            return IDBKeyRange.bound(
                [roomId, this._upper.fragmentId, EventKey.minKey.eventIndex],
                [roomId, this._upper.fragmentId, this._upper.eventIndex],
                false,
                this._upperOpen
            );
        }
        // bound
        if (this._lower && this._upper) {
            return IDBKeyRange.bound(
                [roomId, this._lower.fragmentId, this._lower.eventIndex],
                [roomId, this._upper.fragmentId, this._upper.eventIndex],
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
 * @property  {EventKey} eventKey
 * @property  {?Event} event if an event entry, the event
 * @property  {?Gap} gap if a gap entry, the gap
*/
export default class TimelineEventStore {
	constructor(timelineStore) {
		this._timelineStore = timelineStore;
	}

    /** Creates a range that only includes the given key
     *  @param {EventKey} eventKey the key
     *  @return {Range} the created range
     */
    onlyRange(eventKey) {
        return new Range(eventKey);
    }

    /** Creates a range that includes all keys before eventKey, and optionally also the key itself.
     *  @param {EventKey} eventKey the key
     *  @param {boolean} [open=false] whether the key is included (false) or excluded (true) from the range at the upper end.
     *  @return {Range} the created range
     */
    upperBoundRange(eventKey, open=false) {
        return new Range(undefined, undefined, eventKey, undefined, open);
    }

    /** Creates a range that includes all keys after eventKey, and optionally also the key itself.
     *  @param {EventKey} eventKey the key
     *  @param {boolean} [open=false] whether the key is included (false) or excluded (true) from the range at the lower end.
     *  @return {Range} the created range
     */
    lowerBoundRange(eventKey, open=false) {
        return new Range(undefined, eventKey, undefined, open);
    }

    /** Creates a range that includes all keys between `lower` and `upper`, and optionally the given keys as well.
     *  @param {EventKey} lower the lower key
     *  @param {EventKey} upper the upper key
     *  @param {boolean} [lowerOpen=false] whether the lower key is included (false) or excluded (true) from the range.
     *  @param {boolean} [upperOpen=false] whether the upper key is included (false) or excluded (true) from the range.
     *  @return {Range} the created range
     */
    boundRange(lower, upper, lowerOpen=false, upperOpen=false) {
        return new Range(undefined, lower, upper, lowerOpen, upperOpen);
    }

    /** Looks up the last `amount` entries in the timeline for `roomId`.
     *  @param  {string} roomId
     *  @param  {number} fragmentId
     *  @param  {number} amount
     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
     */
	async lastEvents(roomId, fragmentId, amount) {
        const eventKey = EventKey.maxKey;
        eventKey.fragmentId = fragmentId;
		return this.eventsBefore(roomId, eventKey, amount);
	}

    /** Looks up the first `amount` entries in the timeline for `roomId`.
     *  @param  {string} roomId
     *  @param  {number} fragmentId
     *  @param  {number} amount
     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
     */
	async firstEvents(roomId, fragmentId, amount) {
        const eventKey = EventKey.minKey;
        eventKey.fragmentId = fragmentId;
		return this.eventsAfter(roomId, eventKey, amount);
	}

    /** Looks up `amount` entries after `eventKey` in the timeline for `roomId` within the same fragment.
     *  The entry for `eventKey` is not included.
     *  @param  {string} roomId
     *  @param  {EventKey} eventKey
     *  @param  {number} amount
     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
     */
	eventsAfter(roomId, eventKey, amount) {
        const idbRange = this.lowerBoundRange(eventKey, true).asIDBKeyRange(roomId);
		return this._timelineStore.selectLimit(idbRange, amount);
	}

    /** Looks up `amount` entries before `eventKey` in the timeline for `roomId` within the same fragment.
     *  The entry for `eventKey` is not included.
     *  @param  {string} roomId
     *  @param  {EventKey} eventKey
     *  @param  {number} amount
     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
     */
    async eventsBefore(roomId, eventKey, amount) {
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
     *  @param  {string} roomId
     *  @param  {string[]} eventIds
     *  @return {Function<Promise>}
     */
    // performance comment from above refers to the fact that there *might*
    // be a correlation between event_id sorting order and chronology.
    // In that case we could avoid running over all eventIds, as the reported order by findExistingKeys
    // would match the order of eventIds. That's why findLast is also passed as backwards to keysExist.
    // also passing them in chronological order makes sense as that's how we'll receive them almost always.
    async findFirstOccurringEventId(roomId, eventIds) {
        const byEventId = this._timelineStore.index("byEventId");
        const keys = eventIds.map(eventId => [roomId, eventId]);
        const results = new Array(keys.length);
        let firstFoundKey;

        // find first result that is found and has no undefined results before it
        function firstFoundAndPrecedingResolved() {
            for(let i = 0; i < results.length; ++i) {
                if (results[i] === undefined) {
                    return;
                } else if(results[i] === true) {
                    return keys[i];
                }
            }
        }

        await byEventId.findExistingKeys(keys, false, (key, found) => {
            const index = keys.indexOf(key);
            results[index] = found;
            firstFoundKey = firstFoundAndPrecedingResolved();
            return !!firstFoundKey;
        });
        // key of index is [roomId, eventId], so pick out eventId
        return firstFoundKey && firstFoundKey[1];
    }

    /** Inserts a new entry into the store. The combination of roomId and eventKey should not exist yet, or an error is thrown.
     *  @param  {Entry} entry the entry to insert
     *  @return {Promise<>} a promise resolving to undefined if the operation was successful, or a StorageError if not.
     *  @throws {StorageError} ...
     */
    insert(entry) {
        // TODO: map error? or in idb/store?
        return this._timelineStore.add(entry);
    }

    /** Updates the entry into the store with the given [roomId, eventKey] combination.
     *  If not yet present, will insert. Might be slower than add.
     *  @param  {Entry} entry the entry to update.
     *  @return {Promise<>} a promise resolving to undefined if the operation was successful, or a StorageError if not.
     */
    update(entry) {
        return this._timelineStore.put(entry);
    }

    get(roomId, eventKey) {
        return this._timelineStore.get([roomId, eventKey.fragmentId, eventKey.eventIndex]);
    }
    // returns the entries as well!! (or not always needed? I guess not always needed, so extra method)
    removeRange(roomId, range) {
        // TODO: read the entries!
        return this._timelineStore.delete(range.asIDBKeyRange(roomId));
    }

    getByEventId(roomId, eventId) {
        return this._timelineStore.index("byEventId").get([roomId, eventId]);
    }
}
