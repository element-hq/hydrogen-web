import Platform from "../../../Platform.js";

// key for events in the timelineEvents store
export default class EventKey {
    constructor(fragmentId, eventIndex) {
        this.fragmentId = fragmentId;
        this.eventIndex = eventIndex;
    }

    nextFragmentKey() {
        // could take MIN_EVENT_INDEX here if it can't be paged back
        return new EventKey(this.fragmentId + 1, Platform.middleStorageKey);
    }

    nextKeyForDirection(direction) {
        if (direction.isForward) {
            return this.nextKey();
        } else {
            return this.previousKey();
        }
    }

    previousKey() {
        return new EventKey(this.fragmentId, this.eventIndex - 1);
    }

    nextKey() {
        return new EventKey(this.fragmentId, this.eventIndex + 1);
    }

    static get maxKey() {
        return new EventKey(Platform.maxStorageKey, Platform.maxStorageKey);
    }

    static get minKey() {
        return new EventKey(Platform.minStorageKey, Platform.minStorageKey);
    }

    static get defaultLiveKey() {
        return new EventKey(Platform.minStorageKey, Platform.middleStorageKey);
    }

    toString() {
        return `[${this.fragmentId}/${this.eventIndex}]`;
    }
}

//#ifdef TESTS
export function xtests() {
    const fragmentIdComparer = {compare: (a, b) => a - b};

    return {
        test_no_fragment_index(assert) {
            const min = EventKey.minKey;
            const max = EventKey.maxKey;
            const a = new EventKey();
            a.eventIndex = 1;
            a.fragmentId = 1;

            assert(min.compare(min) === 0);
            assert(max.compare(max) === 0);
            assert(a.compare(a) === 0);

            assert(min.compare(max) < 0);
            assert(max.compare(min) > 0);

            assert(min.compare(a) < 0);
            assert(a.compare(min) > 0);
            
            assert(max.compare(a) > 0);
            assert(a.compare(max) < 0);
        },

        test_default_key(assert) {
            const k = new EventKey(fragmentIdComparer);
            assert.equal(k.fragmentId, MID);
            assert.equal(k.eventIndex, MID);
        },

        test_inc(assert) {
            const a = new EventKey(fragmentIdComparer);
            const b = a.nextKey();
            assert.equal(a.fragmentId, b.fragmentId);
            assert.equal(a.eventIndex + 1, b.eventIndex);
            const c = b.previousKey();
            assert.equal(b.fragmentId, c.fragmentId);
            assert.equal(c.eventIndex + 1, b.eventIndex);
            assert.equal(a.eventIndex, c.eventIndex);
        },

        test_min_key(assert) {
            const minKey = EventKey.minKey;
            const k = new EventKey(fragmentIdComparer);
            assert(minKey.fragmentId <= k.fragmentId);
            assert(minKey.eventIndex <= k.eventIndex);
            assert(k.compare(minKey) > 0);
            assert(minKey.compare(k) < 0);
        },

        test_max_key(assert) {
            const maxKey = EventKey.maxKey;
            const k = new EventKey(fragmentIdComparer);
            assert(maxKey.fragmentId >= k.fragmentId);
            assert(maxKey.eventIndex >= k.eventIndex);
            assert(k.compare(maxKey) < 0);
            assert(maxKey.compare(k) > 0);
        },

        test_immutable(assert) {
            const a = new EventKey(fragmentIdComparer);
            const fragmentId = a.fragmentId;
            const eventIndex = a.eventIndex;
            a.nextFragmentKey();
            assert.equal(a.fragmentId, fragmentId);
            assert.equal(a.eventIndex, eventIndex);
        },

        test_cmp_fragmentid_first(assert) {
            const a = new EventKey(fragmentIdComparer);
            const b = new EventKey(fragmentIdComparer);
            a.fragmentId = 2;
            a.eventIndex = 1;
            b.fragmentId = 1;
            b.eventIndex = 100000;
            assert(a.compare(b) > 0);
        },

        test_cmp_eventindex_second(assert) {
            const a = new EventKey(fragmentIdComparer);
            const b = new EventKey(fragmentIdComparer);
            a.fragmentId = 1;
            a.eventIndex = 100000;
            b.fragmentId = 1;
            b.eventIndex = 2;
            assert(a.compare(b) > 0);
            assert(b.compare(a) < 0);
        },

        test_cmp_max_larger_than_min(assert) {
            assert(EventKey.minKey.compare(EventKey.maxKey) < 0);
        },

        test_cmp_fragmentid_first_large(assert) {
            const a = new EventKey(fragmentIdComparer);
            const b = new EventKey(fragmentIdComparer);
            a.fragmentId = MAX;
            a.eventIndex = MIN;
            b.fragmentId = MIN;
            b.eventIndex = MAX;
            assert(b < a);
            assert(a > b);
        }
    };
}
//#endif
