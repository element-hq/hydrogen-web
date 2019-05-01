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
	constructor(fragmentIndex, buffer) {
		if (buffer) {
			this._keys = new DataView(buffer);
		} else {
			this._keys = new DataView(new ArrayBuffer(8));
			// start default key right at the middle fragment key, min event key
			// so we have the same amount of key address space either way
			this.fragmentKey = MID;
			this.eventKey = MIN;
		}
        this._fragmentIndex = fragmentIndex;
	}

	get fragmentKey() {
		return this._keys.getUint32(0, false);
	}

	set fragmentKey(value) {
		return this._keys.setUint32(0, value, false);
	}

	get eventKey() {
		return this._keys.getUint32(4, false);
	}

	set eventKey(value) {
		return this._keys.setUint32(4, value, false);
	}

	get buffer() {
		return this._keys.buffer;
	}

	nextFragmentKey() {
		const k = new SortKey(this._fragmentIndex);
		k.fragmentKey = this.fragmentKey + 1;
		k.eventKey = MIN;
		return k;
	}

	nextKey() {
		const k = new SortKey(this._fragmentIndex);
		k.fragmentKey = this.fragmentKey;
		k.eventKey = this.eventKey + 1;
		return k;
	}

	previousKey() {
		const k = new SortKey(this._fragmentIndex);
		k.fragmentKey = this.fragmentKey;
		k.eventKey = this.eventKey - 1;
		return k;
	}

	clone() {
		const k = new SortKey();
		k.fragmentKey = this.fragmentKey;
		k.eventKey = this.eventKey;	
		return k;
	}

	static get maxKey() {
		const maxKey = new SortKey(null);
		maxKey.fragmentKey = MAX;
		maxKey.eventKey = MAX;
		return maxKey;
	}

	static get minKey() {
		const minKey = new SortKey(null);
		minKey.fragmentKey = MIN;
		minKey.eventKey = MIN;
		return minKey;
	}

    compare(otherKey) {
        const fragmentDiff = this.fragmentKey - otherKey.fragmentKey;
        if (fragmentDiff === 0) {
            return this.eventKey - otherKey.eventKey;
        } else {
            // minKey and maxKey might not have fragmentIndex, so short-circuit this first ...
            if (this.fragmentKey === MIN || otherKey.fragmentKey === MAX) {
                return -1;
            }
            if (this.fragmentKey === MAX || otherKey.fragmentKey === MIN) {
                return 1;
            }
            // ... then delegate to fragmentIndex.
            // This might throw if the relation of two fragments is unknown.
            return this._fragmentIndex.compare(this.fragmentKey, otherKey.fragmentKey);
        }
    }

	toString() {
		return `[${this.fragmentKey}/${this.eventKey}]`;
	}
}

//#ifdef TESTS
export function tests() {
    const fragmentIndex = {compare: (a, b) => a - b};

	return {
		test_default_key(assert) {
			const k = new SortKey(fragmentIndex);
			assert.equal(k.fragmentKey, MID);
			assert.equal(k.eventKey, MIN);
		},

		test_inc(assert) {
			const a = new SortKey(fragmentIndex);
			const b = a.nextKey();
			assert.equal(a.fragmentKey, b.fragmentKey);
			assert.equal(a.eventKey + 1, b.eventKey);
			const c = b.previousKey();
			assert.equal(b.fragmentKey, c.fragmentKey);
			assert.equal(c.eventKey + 1, b.eventKey);
			assert.equal(a.eventKey, c.eventKey);
		},

		test_min_key(assert) {
			const minKey = SortKey.minKey;
			const k = new SortKey(fragmentIndex);
			assert(minKey.fragmentKey <= k.fragmentKey);
			assert(minKey.eventKey <= k.eventKey);
            assert(k.compare(minKey) > 0);
            assert(minKey.compare(k) < 0);
		},

		test_max_key(assert) {
			const maxKey = SortKey.maxKey;
			const k = new SortKey(fragmentIndex);
			assert(maxKey.fragmentKey >= k.fragmentKey);
			assert(maxKey.eventKey >= k.eventKey);
            assert(k.compare(maxKey) < 0);
            assert(maxKey.compare(k) > 0);
		},

		test_immutable(assert) {
			const a = new SortKey(fragmentIndex);
			const fragmentKey = a.fragmentKey;
			const eventKey = a.eventKey;
			a.nextFragmentKey();
			assert.equal(a.fragmentKey, fragmentKey);
			assert.equal(a.eventKey, eventKey);
		},

		test_cmp_fragmentkey_first(assert) {
			const a = new SortKey(fragmentIndex);
			const b = new SortKey(fragmentIndex);
			a.fragmentKey = 2;
			a.eventKey = 1;
			b.fragmentKey = 1;
			b.eventKey = 100000;
			assert(a.compare(b) > 0);
		},

		test_cmp_eventkey_second(assert) {
			const a = new SortKey(fragmentIndex);
			const b = new SortKey(fragmentIndex);
			a.fragmentKey = 1;
			a.eventKey = 100000;
			b.fragmentKey = 1;
			b.eventKey = 2;
			assert(a.compare(b) > 0);
		},

		test_cmp_max_larger_than_min(assert) {
			assert(SortKey.minKey.compare(SortKey.maxKey) < 0);
		},

		test_cmp_fragmentkey_first_large(assert) {
			const a = new SortKey(fragmentIndex);
			const b = new SortKey(fragmentIndex);
			a.fragmentKey = MAX;
			a.eventKey = MIN;
			b.fragmentKey = MIN;
			b.eventKey = MAX;
			assert(b < a);
			assert(a > b);
		}
	};
}
//#endif
