import BaseObservableList from "./BaseObservableList.js";

export default class ObservableArray extends BaseObservableList {
    constructor() {
        super();
        this._items = [];
    }

    append(item) {
        this._items.push(item);
        this.emitAdd(this._items.length - 1, item);
    }

    insertMany(idx, items) {
        for(let item of items) {
            this.insert(idx, item);
            idx += 1;
        }
    }

    insert(idx, item) {
        this._items.splice(idx, 0, item);
        this.emitAdd(idx, item);
    }

    get array() {
        return this._items;
    }

    at(idx) {
        if (this._items && idx >= 0 && idx < this._items.length) {
            return this._items[idx];
        }
    }

    get length() {
        return this._items.length;
    }

    [Symbol.iterator]() {
        return this._items.values();
    }
}
