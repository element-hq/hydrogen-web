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
	constructor(buffer) {
		if (buffer) {
			this._keys = new DataView(buffer);
		} else {
			this._keys = new DataView(new ArrayBuffer(8));
			// start default key right at the middle gap key, min event key
			// so we have the same amount of key address space either way
			this.gapKey = MID;
			this.eventKey = MIN;
		}
	}

	get gapKey() {
		return this._keys.getUint32(0, false);
	}

	set gapKey(value) {
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

	nextKeyWithGap() {
		const k = new SortKey();
		k.gapKey = this.gapKey + 1;
		k.eventKey = MIN;
		return k;
	}

	nextKey() {
		const k = new SortKey();
		k.gapKey = this.gapKey;
		k.eventKey = this.eventKey + 1;
		return k;
	}

	previousKey() {
		const k = new SortKey();
		k.gapKey = this.gapKey;
		k.eventKey = this.eventKey - 1;
		return k;
	}

	clone() {
		const k = new SortKey();
		k.gapKey = this.gapKey;
		k.eventKey = this.eventKey;	
		return k;
	}

	static get maxKey() {
		const maxKey = new SortKey();
		maxKey.gapKey = MAX;
		maxKey.eventKey = MAX;
		return maxKey;
	}

	static get minKey() {
		const minKey = new SortKey();
		minKey.gapKey = MIN;
		minKey.eventKey = MIN;
		return minKey;
	}

    compare(otherKey) {
        const gapDiff = this.gapKey - otherKey.gapKey;
        if (gapDiff === 0) {
            return this.eventKey - otherKey.eventKey;
        } else {
            return gapDiff;
        }
    }

	toString() {
		return `[${this.gapKey}/${this.eventKey}]`;
	}
}

//#ifdef TESTS
export function tests() {
	return {
		test_default_key(assert) {
			const k = new SortKey();
			assert.equal(k.gapKey, MID);
			assert.equal(k.eventKey, MIN);
		},

		test_inc(assert) {
			const a = new SortKey();
			const b = a.nextKey();
			assert.equal(a.gapKey, b.gapKey);
			assert.equal(a.eventKey + 1, b.eventKey);
			const c = b.previousKey();
			assert.equal(b.gapKey, c.gapKey);
			assert.equal(c.eventKey + 1, b.eventKey);
			assert.equal(a.eventKey, c.eventKey);
		},

		test_min_key(assert) {
			const minKey = SortKey.minKey;
			const k = new SortKey();
			assert(minKey.gapKey <= k.gapKey);
			assert(minKey.eventKey <= k.eventKey);
		},

		test_max_key(assert) {
			const maxKey = SortKey.maxKey;
			const k = new SortKey();
			assert(maxKey.gapKey >= k.gapKey);
			assert(maxKey.eventKey >= k.eventKey);
		},

		test_immutable(assert) {
			const a = new SortKey();
			const gapKey = a.gapKey;
			const eventKey = a.eventKey;
			a.nextKeyWithGap();
			assert.equal(a.gapKey, gapKey);
			assert.equal(a.eventKey, eventKey);
		},

		test_cmp_gapkey_first(assert) {
			const a = new SortKey();
			const b = new SortKey();
			a.gapKey = 2;
			a.eventKey = 1;
			b.gapKey = 1;
			b.eventKey = 100000;
			assert(a.compare(b) > 0);
		},

		test_cmp_eventkey_second(assert) {
			const a = new SortKey();
			const b = new SortKey();
			a.gapKey = 1;
			a.eventKey = 100000;
			b.gapKey = 1;
			b.eventKey = 2;
			assert(a.compare(b) > 0);
		},

		test_cmp_max_larger_than_min(assert) {
			assert(SortKey.minKey.compare(SortKey.maxKey) < 0);
		},

		test_cmp_gapkey_first_large(assert) {
			const a = new SortKey();
			const b = new SortKey();
			a.gapKey = MAX;
			a.eventKey = MIN;
			b.gapKey = MIN;
			b.eventKey = MAX;
			assert(b < a);
			assert(a > b);
		}
	};
}
//#endif
