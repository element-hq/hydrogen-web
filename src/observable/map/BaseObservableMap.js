import BaseObservableCollection from "../BaseObservableCollection.js";

export default class BaseObservableMap extends BaseObservableCollection {
    emitReset() {
        for(let h of this._handlers) {
            h.onReset();
        }
    }
    // we need batch events, mostly on index based collection though?
    // maybe we should get started without?
    emitAdd(key, value) {
        for(let h of this._handlers) {
            h.onAdd(key, value);
        }
    }

    emitUpdate(key, value, ...params) {
        for(let h of this._handlers) {
            h.onUpdate(key, value, ...params);
        }
    }

    emitRemove(key, value) {
        for(let h of this._handlers) {
            h.onRemove(key, value);
        }
    }

    // map(mapper, updater) {
    //     return new MapOperator(this, mapper, updater);
    // }

    // sort(comparator) {
    //     return new SortOperator(this, comparator);
    // }
}
