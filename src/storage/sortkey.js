class GapSortKey {
	constructor() {
		this._keys = new Int32Array(2);
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

	buffer() {
		return this._keys.buffer;
	}

	nextKeyWithGap() {
		const k = new Key();
		k.gapKey = this.gapKey + 1;
		k.eventKey = 0;
		return k;
	}

	nextKey() {
		const k = new Key();
		k.gapKey = this.gapKey;
		k.eventKey = this.eventKey + 1;
		return k;
	}

	previousKey() {
		const k = new Key();
		k.gapKey = this.gapKey;
		k.eventKey = this.eventKey - 1;
		return k;
	}

	clone() {
		const k = new Key();
		k.gapKey = this.gapKey;
		k.eventKey = this.eventKey;	
		return k;
	}

	static get maxKey() {
		const maxKey = new GapSortKey();
		maxKey.gapKey = Number.MAX_SAFE_INTEGER;
		maxKey.eventKey = Number.MAX_SAFE_INTEGER;
		return maxKey;
	}

	static get minKey() {
		const minKey = new GapSortKey();
		minKey.gapKey = 0;
		minKey.eventKey = 0;
		return minKey;
	}
}
