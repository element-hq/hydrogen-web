// import BaseObservableMap from "./BaseObservableMap.js";

export default class Operator /* extends BaseObservableMap */ {
    constructor(source) {
        // super();
        this._source = source;
    }

    onSubscribeFirst() {
        this._sourceSubscription = this._source.subscribe(this);
    }

    onUnsubscribeLast() {
        this._sourceSubscription();
        this._sourceSubscription = null;
    }

    onRemove(key, value) {}
    onAdd(key, value) {}
    onChange(key, value, params) {}
    onReset() {}
}
