import MapOperator from "./operators/MapOperator.js";
import SortOperator from "./operators/SortOperator.js";

export default class BaseObservableMap {
    constructor() {
        this._handlers = new Set();
    }

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

    emitChange(key, value, ...params) {
        for(let h of this._handlers) {
            h.onChange(key, value, ...params);
        }
    }

    emitRemove(key, value) {
        for(let h of this._handlers) {
            h.onRemove(key, value);
        }
    }

    onSubscribeFirst() {

    }

    onUnsubscribeLast() {

    }

    subscribe(handler) {
        this._handlers.add(handler);
        if (this._handlers.length === 1) {
            this.onSubscribeFirst();
        }
        return () => {
            if (handler) {
                this._handlers.delete(this._handler);
                if (this._handlers.length === 0) {
                    this.onUnsubscribeLast();
                }
                handler = null;
            }
            return null;
        };
    }

    map(mapper, updater) {
        return new MapOperator(this, mapper, updater);
    }

    sort(comparator) {
        return new SortOperator(this, comparator);
    }
}
