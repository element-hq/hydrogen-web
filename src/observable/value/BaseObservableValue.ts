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

import {AbortError} from "../../utils/error";
import {BaseObservable} from "../BaseObservable";
import type {SubscriptionHandle} from "../BaseObservable";
import {FlatMapObservableValue} from "./index";

// like an EventEmitter, but doesn't have an event type
export abstract class BaseObservableValue<T> extends BaseObservable<(value: T) => void> {
    emit(argument: T): void {
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

    flatMap<C>(mapper: (value: T) => (BaseObservableValue<C> | undefined)): BaseObservableValue<C | undefined> {
        return new FlatMapObservableValue<T, C>(this, mapper);
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

    dispose(): void {
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
    dispose(): void {}
}
