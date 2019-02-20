import Operator from "../Operator.js";

export default class FilterOperator extends Operator {
    constructor(source, mapper, updater) {
        super(source);
        this._mapper = mapper;
        this._updater = updater;
        this._mappedValues = new Map();
    }

    onAdd(key, value) {
        const mappedValue = this._mapper(value);
        this._mappedValues.set(key, mappedValue);
        this.emitAdd(key, mappedValue);
    }

    onRemove(key, _value) {
        const mappedValue = this._mappedValues.get(key);
        if (this._mappedValues.delete(key)) {
            this.emitRemove(key, mappedValue);
        }
    }

    onChange(key, value, params) {
        const mappedValue = this._mappedValues.get(key);
        if (mappedValue !== undefined) {
            const newParams = this._updater(value, params);
            if (newParams !== undefined) {
                this.emitChange(key, mappedValue, newParams);
            }
        }
    }

    onSubscribeFirst() {
        for (let [key, value] of this._source) {
            const mappedValue = this._mapper(value);
            this._mappedValues.set(key, mappedValue);
        }
        super.onSubscribeFirst();
    }

    onUnsubscribeLast() {
        super.onUnsubscribeLast();
        this._mappedValues.clear();
    }

    onReset() {
        this._mappedValues.clear();
        this.emitReset();
    }

    [Symbol.iterator]() {
        return this._mappedValues.entries()[Symbol.iterator];
    }
}
