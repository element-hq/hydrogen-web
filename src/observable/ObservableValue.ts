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

import {AbortError} from "../utils/error.js";
import {BaseObservable} from "./BaseObservable";

// like an EventEmitter, but doesn't have an event type
export abstract class BaseObservableValue<T> extends BaseObservable<(value: T) => void> {
    emit(argument: T) {
        for (const h of this._handlers) {
            h(argument);
        }
    }

    abstract get(): T;

    waitFor(predicate: (value: T) => boolean): IWaitHandle<T> {
        if (predicate(this.get())) {
            return new ResolvedWaitForHandle(Promise.resolve(this.get()));
        } else {
            return new WaitForHandle(this, predicate);
        }
    }
}

interface IWaitHandle<T> {
    promise: Promise<T>;
    dispose(): void;
}

class WaitForHandle<T> implements IWaitHandle<T> {
    private _promise: Promise<T>
    private _reject: ((reason?: any) => void) | null;
    private _subscription: (() => void) | null;

    constructor(observable: BaseObservableValue<T>, predicate: (value: T) => boolean) {
        this._promise = new Promise((resolve, reject) => {
            this._reject = reject;
            this._subscription = observable.subscribe(v => {
                if (predicate(v)) {
                    this._reject = null;
                    resolve(v);
                    this.dispose();
                }
            });
        });
    }

    get promise(): Promise<T> {
        return this._promise;
    }

    dispose() {
        if (this._subscription) {
            this._subscription();
            this._subscription = null;
        }
        if (this._reject) {
            this._reject(new AbortError());
            this._reject = null;
        }
    }
}

class ResolvedWaitForHandle<T> implements IWaitHandle<T> {
    constructor(public promise: Promise<T>) {}
    dispose() {}
}

export class ObservableValue<T> extends BaseObservableValue<T> {
    private _value: T;

    constructor(initialValue: T) {
        super();
        this._value = initialValue;
    }

    get(): T {
        return this._value;
    }

    set(value: T): void {
        if (value !== this._value) {
            this._value = value;
            this.emit(this._value);
        }
    }
}

export class RetainedObservableValue<T> extends ObservableValue<T> {
    private _freeCallback: () => void;

    constructor(initialValue: T, freeCallback: () => void) {
        super(initialValue);
        this._freeCallback = freeCallback;
    }

    onUnsubscribeLast() {
        super.onUnsubscribeLast();
        this._freeCallback();
    }
}

export function tests() {
    return {
        "set emits an update": assert => {
            const a = new ObservableValue<number>(0);
            let fired = false;
            const subscription = a.subscribe(v => {
                fired = true;
                assert.strictEqual(v, 5);
            });
            a.set(5);
            assert(fired);
            subscription();
        },
        "set doesn't emit if value hasn't changed": assert => {
            const a = new ObservableValue(5);
            let fired = false;
            const subscription = a.subscribe(() => {
                fired = true;
            });
            a.set(5);
            a.set(5);
            assert(!fired);
            subscription();
        },
        "waitFor promise resolves on matching update": async assert => {
            const a = new ObservableValue(5);
            const handle = a.waitFor(v => v === 6);
            Promise.resolve().then(() => {
                a.set(6);
            });
            await handle.promise;
            assert.strictEqual(a.get(), 6);
        },
        "waitFor promise rejects when disposed": async assert => {
            const a = new ObservableValue<number>(0);
            const handle = a.waitFor(() => false);
            Promise.resolve().then(() => {
                handle.dispose();
            });
            await assert.rejects(handle.promise, AbortError);
        },
    }
}
