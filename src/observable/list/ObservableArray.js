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

    get length() {
        return this._items.length;
    }

    [Symbol.iterator]() {
        return this._items.values();
    }
}
