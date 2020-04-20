import {BaseObservableMap} from "./BaseObservableMap.js";
/*
so a mapped value can emit updates on it's own with this._updater that is passed in the mapping function
how should the mapped value be notified of an update though? and can it then decide to not propagate the update?
*/
export class MappedMap extends BaseObservableMap {
    constructor(source, mapper) {
        super();
        this._source = source;
        this._mapper = mapper;
        this._mappedValues = new Map();
        this._updater = (key, params) => {  // this should really be (value, params) but can't make that work for now
            const value = this._mappedValues.get(key);
            this.onUpdate(key, value, params);
        };
    }

    onAdd(key, value) {
        const mappedValue = this._mapper(value, this._updater);
        this._mappedValues.set(key, mappedValue);
        this.emitAdd(key, mappedValue);
    }

    onRemove(key, _value) {
        const mappedValue = this._mappedValues.get(key);
        if (this._mappedValues.delete(key)) {
            this.emitRemove(key, mappedValue);
        }
    }

    onUpdate(key, value, params) {
        const mappedValue = this._mappedValues.get(key);
        if (mappedValue !== undefined) {
            const newParams = this._updater(value, params);
            // if (newParams !== undefined) {
                this.emitUpdate(key, mappedValue, newParams);
            // }
        }
    }

    onSubscribeFirst() {
        this._subscription = this._source.subscribe(this);
        for (let [key, value] of this._source) {
            const mappedValue = this._mapper(value, this._updater);
            this._mappedValues.set(key, mappedValue);
        }
        super.onSubscribeFirst();
    }

    onUnsubscribeLast() {
        this._subscription = this._subscription();
        this._mappedValues.clear();
    }

    onReset() {
        this._mappedValues.clear();
        this.emitReset();
    }

    [Symbol.iterator]() {
        return this._mappedValues.entries();
    }
}
