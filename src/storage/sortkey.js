const MIN_INT32 = -2147483648;
const MAX_INT32 = 2147483647;

export default class SortKey {
	constructor(buffer) {
		if (buffer) {
			this._keys = new Int32Array(buffer, 2);
		} else {
			this._keys = new Int32Array(2);
		}
	}

	get gapKey() {
		return this._keys[0];
	}

	set gapKey(value) {
		this._keys[0] = value;
	}

	get eventKey() {
		return this._keys[1];
	}

	set eventKey(value) {
		this._keys[1] = value;
	}

	get buffer() {
		return this._keys.buffer;
	}

	nextKeyWithGap() {
		const k = new SortKey();
		k.gapKey = this.gapKey + 1;
		k.eventKey = 0;
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
		maxKey.gapKey = MAX_INT32;
		maxKey.eventKey = MAX_INT32;
		return maxKey;
	}

	static get minKey() {
		const minKey = new SortKey();
		minKey.gapKey = MIN_INT32;
		minKey.eventKey = MIN_INT32;
		return minKey;
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
			assert.equal(k.gapKey, 0);
			assert.equal(k.eventKey, 0);
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
			assert(minKey.gapKey < k.gapKey);
			assert(minKey.eventKey < k.eventKey);
		},

		test_max_key(assert) {
			const maxKey = SortKey.maxKey;
			const k = new SortKey();
			assert(maxKey.gapKey > k.gapKey);
			assert(maxKey.eventKey > k.eventKey);
		},

		test_immutable(assert) {
			const a = new SortKey();
			const gapKey = a.gapKey;
			const eventKey = a.gapKey;
			a.nextKeyWithGap();
			assert.equal(a.gapKey, gapKey);
			assert.equal(a.eventKey, eventKey);
		}
	};
}
//#endif