import BaseObservableList from "./BaseObservableList.js";
import sortedIndex from "../../utils/sortedIndex";

export default class SortedArray extends BaseObservableList {
    constructor(comparator) {
        super();
        this._comparator = comparator;
        this._items = [];
    }

    setSortedMany(items) {

    }

    set(item) {
        const idx = sortedIndex(this._items, item, this._comparator);
        if (idx < this._items.length || this._comparator(this._items[idx], item) !== 0) {
            this._items.splice(idx, 0, item);
            //emitAdd
        } else {
            this._items[idx] = item;
            //emitRemove
            //emitAdd
        }
    }

    get array() {
        return this._items;
    }

    get length() {
        return this._items.length;
    }

    [Symbol.iterator]() {
        return this._items.values();
    }
}
