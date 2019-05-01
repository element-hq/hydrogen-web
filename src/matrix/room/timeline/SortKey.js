const MIN_INT32 = -2147483648;
const MID_INT32 = 0;
const MAX_INT32 = 2147483647;

const MIN_UINT32 = 0;
const MID_UINT32 = 2147483647;
const MAX_UINT32 = 4294967295;

const MIN = MIN_UINT32;
const MID = MID_UINT32;
const MAX = MAX_UINT32;

export default class SortKey {
	constructor(fragmentIdComparer, buffer) {
		if (buffer) {
			this._keys = new DataView(buffer);
		} else {
			this._keys = new DataView(new ArrayBuffer(8));
			// start default key right at the middle fragment key, min event key
			// so we have the same amount of key address space either way
			this.fragmentId = MID;
			this.eventIndex = MIN;
		}
        this._fragmentIdComparer = fragmentIdComparer;
	}

	get fragmentId() {
		return this._keys.getUint32(0, false);
	}

	set fragmentId(value) {
		return this._keys.setUint32(0, value, false);
	}

	get eventIndex() {
		return this._keys.getUint32(4, false);
	}

	set eventIndex(value) {
		return this._keys.setUint32(4, value, false);
	}

	get buffer() {
		return this._keys.buffer;
	}

	nextFragmentKey() {
		const k = new SortKey(this._fragmentIdComparer);
		k.fragmentId = this.fragmentId + 1;
		k.eventIndex = MIN;
		return k;
	}

	nextKey() {
		const k = new SortKey(this._fragmentIdComparer);
		k.fragmentId = this.fragmentId;
		k.eventIndex = this.eventIndex + 1;
		return k;
	}

	previousKey() {
		const k = new SortKey(this._fragmentIdComparer);
		k.fragmentId = this.fragmentId;
		k.eventIndex = this.eventIndex - 1;
		return k;
	}

	clone() {
		const k = new SortKey();
		k.fragmentId = this.fragmentId;
		k.eventIndex = this.eventIndex;	
		return k;
	}

	static get maxKey() {
		const maxKey = new SortKey(null);
		maxKey.fragmentId = MAX;
		maxKey.eventIndex = MAX;
		return maxKey;
	}

	static get minKey() {
		const minKey = new SortKey(null);
		minKey.fragmentId = MIN;
		minKey.eventIndex = MIN;
		return minKey;
	}

    compare(otherKey) {
        const fragmentDiff = this.fragmentId - otherKey.fragmentId;
        if (fragmentDiff === 0) {
            return this.eventIndex - otherKey.eventIndex;
        } else {
            // minKey and maxKey might not have fragmentIdComparer, so short-circuit this first ...
            if (this.fragmentId === MIN || otherKey.fragmentId === MAX) {
                return -1;
            }
            if (this.fragmentId === MAX || otherKey.fragmentId === MIN) {
                return 1;
            }
            // ... then delegate to fragmentIdComparer.
            // This might throw if the relation of two fragments is unknown.
            return this._fragmentIdComparer.compare(this.fragmentId, otherKey.fragmentId);
        }
    }

	toString() {
		return `[${this.fragmentId}/${this.eventIndex}]`;
	}
}

//#ifdef TESTS
export function tests() {
    const fragmentIdComparer = {compare: (a, b) => a - b};

	return {
		test_default_key(assert) {
			const k = new SortKey(fragmentIdComparer);
			assert.equal(k.fragmentId, MID);
			assert.equal(k.eventIndex, MIN);
		},

		test_inc(assert) {
			const a = new SortKey(fragmentIdComparer);
			const b = a.nextKey();
			assert.equal(a.fragmentId, b.fragmentId);
			assert.equal(a.eventIndex + 1, b.eventIndex);
			const c = b.previousKey();
			assert.equal(b.fragmentId, c.fragmentId);
			assert.equal(c.eventIndex + 1, b.eventIndex);
			assert.equal(a.eventIndex, c.eventIndex);
		},

		test_min_key(assert) {
			const minKey = SortKey.minKey;
			const k = new SortKey(fragmentIdComparer);
			assert(minKey.fragmentId <= k.fragmentId);
			assert(minKey.eventIndex <= k.eventIndex);
            assert(k.compare(minKey) > 0);
            assert(minKey.compare(k) < 0);
		},

		test_max_key(assert) {
			const maxKey = SortKey.maxKey;
			const k = new SortKey(fragmentIdComparer);
			assert(maxKey.fragmentId >= k.fragmentId);
			assert(maxKey.eventIndex >= k.eventIndex);
            assert(k.compare(maxKey) < 0);
            assert(maxKey.compare(k) > 0);
		},

		test_immutable(assert) {
			const a = new SortKey(fragmentIdComparer);
			const fragmentId = a.fragmentId;
			const eventIndex = a.eventIndex;
			a.nextFragmentKey();
			assert.equal(a.fragmentId, fragmentId);
			assert.equal(a.eventIndex, eventIndex);
		},

		test_cmp_fragmentid_first(assert) {
			const a = new SortKey(fragmentIdComparer);
			const b = new SortKey(fragmentIdComparer);
			a.fragmentId = 2;
			a.eventIndex = 1;
			b.fragmentId = 1;
			b.eventIndex = 100000;
			assert(a.compare(b) > 0);
		},

		test_cmp_eventindex_second(assert) {
			const a = new SortKey(fragmentIdComparer);
			const b = new SortKey(fragmentIdComparer);
			a.fragmentId = 1;
			a.eventIndex = 100000;
			b.fragmentId = 1;
			b.eventIndex = 2;
			assert(a.compare(b) > 0);
		},

		test_cmp_max_larger_than_min(assert) {
			assert(SortKey.minKey.compare(SortKey.maxKey) < 0);
		},

		test_cmp_fragmentid_first_large(assert) {
			const a = new SortKey(fragmentIdComparer);
			const b = new SortKey(fragmentIdComparer);
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
