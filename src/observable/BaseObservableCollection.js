export default class BaseObservableCollection {
    constructor() {
        this._handlers = new Set();
    }

    onSubscribeFirst() {

    }

    onUnsubscribeLast() {

    }

    subscribe(handler) {
        this._handlers.add(handler);
        if (this._handlers.size === 1) {
            this.onSubscribeFirst();
        }
        return () => {
            if (handler) {
                this._handlers.delete(handler);
                if (this._handlers.size === 0) {
                    this.onUnsubscribeLast();
                }
                handler = null;
            }
            return null;
        };
    }

    // Add iterator over handlers here
}

// like an EventEmitter, but doesn't have an event type
export class BaseObservableValue extends BaseObservableCollection {
    emit(argument) {
        for (const h of this._handlers) {
            h(argument);
        }
    }
}

export class ObservableValue extends BaseObservableValue {
    constructor(initialValue) {
        super();
        this._value = initialValue;
    }

    get() {
        return this._value;
    }

    set(value) {
        this._value = value;
        this.emit(this._value);
    }
}

export function tests() {
    class Collection extends BaseObservableCollection {
        constructor() {
            super();
            this.firstSubscribeCalls = 0;
            this.firstUnsubscribeCalls = 0;
        }
        onSubscribeFirst() {  this.firstSubscribeCalls += 1; }
        onUnsubscribeLast() { this.firstUnsubscribeCalls += 1; }
    }

    return {
        test_unsubscribe(assert) {
            const c = new Collection();
            const unsubscribe = c.subscribe({});
            unsubscribe();
            assert.equal(c.firstSubscribeCalls, 1);
            assert.equal(c.firstUnsubscribeCalls, 1);
        }
    }
}
