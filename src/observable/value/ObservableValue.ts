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
import {BaseObservableValue} from "./index";

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

export function tests() {
    return {
        "set emits an update": (assert): void => {
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
        "set doesn't emit if value hasn't changed": (assert): void => {
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
        "waitFor promise resolves on matching update": async (assert): Promise<void> => {
            const a = new ObservableValue(5);
            const handle = a.waitFor(v => v === 6);
            await Promise.resolve().then(() => {
                a.set(6);
            });
            await handle.promise;
            assert.strictEqual(a.get(), 6);
        },
        "waitFor promise rejects when disposed": async (assert): Promise<void> => {
            const a = new ObservableValue<number>(0);
            const handle = a.waitFor(() => false);
            await Promise.resolve().then(() => {
                handle.dispose();
            });
            await assert.rejects(handle.promise, AbortError);
        },
    };
}
