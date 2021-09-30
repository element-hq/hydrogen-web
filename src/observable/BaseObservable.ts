/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

export class BaseObservable {
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
            return this.unsubscribe(handler);
        };
    }

    unsubscribe(handler) {
        if (handler) {
            this._handlers.delete(handler);
            if (this._handlers.size === 0) {
                this.onUnsubscribeLast();
            }
            handler = null;
        }
        return null;
    }

    unsubscribeAll() {
        if (this._handlers.size !== 0) {
            this._handlers.clear();
            this.onUnsubscribeLast();
        }
    }

    get hasSubscriptions() {
        return this._handlers.size !== 0;
    }

    // Add iterator over handlers here
}

export function tests() {
    class Collection extends BaseObservable {
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
