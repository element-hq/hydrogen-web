import BaseObservableMap from "./map/BaseObservableMap.js";

export default class ObservableMap extends BaseObservableMap {
    constructor(initialValues) {
        super();
        this._values = new Map(initialValues);
    }

    update(key, params) {
        const value = this._values.get(key);
        if (value !== undefined) {
            this._values.add(key, value);
            this.emitChange(key, value, params);
            return true;
        }
        return false;   // or return existing value?
    }

    add(key, value) {
        if (!this._values.has(key)) {
            this._values.add(key, value);
            this.emitAdd(key, value);
            return true;
        }
        return false;   // or return existing value?
    }

    remove(key) {
        const value = this._values.get(key);
        if (value !== undefined) {
            this._values.delete(key);
            this.emitRemove(key, value);
            return true;
        } else {
            return false;
        }
    }

    reset() {
        this._values.clear();
        this.emitReset();
    }

    get(key) {
        return this._values.get(key);
    }

    get size() {
        return this._values.size;
    }

    [Symbol.iterator]() {
        return this._values.entries()[Symbol.iterator];
    }
}
