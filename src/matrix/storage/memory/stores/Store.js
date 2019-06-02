export default class Store {
    constructor(storeValue, writable) {
        this._storeValue = storeValue;
        this._writable = writable;
    }

    // makes a copy deep enough that any modifications in the store
    // won't affect the original
    // used for transactions
    cloneStoreValue() {
        // assumes 1 level deep is enough, and that values will be replaced
        // rather than updated.
        if (Array.isArray(this._storeValue)) {
            return this._storeValue.slice();
        } else if (typeof this._storeValue === "object") {
            return Object.assign({}, this._storeValue);
        } else {
            return this._storeValue;
        }
    }

    assertWritable() {
        if (!this._writable) {
            throw new Error("Tried to write in read-only transaction");
        }
    }
}
