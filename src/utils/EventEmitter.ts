/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2021 Daniel Fedorin <danila.fedorin@gmail.com>

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

type Handler<T> = (value?: T) => void;

export class EventEmitter<T> {
    private _handlersByName: { [event in keyof T]?: Set<Handler<T[event]>> }

    constructor() {
        this._handlersByName = {};
    }

    emit<K extends keyof T>(name: K, value?: T[K]): void {
        const handlers = this._handlersByName[name];
        if (handlers) {
            handlers.forEach(h => h(value));
        }
    }

    disposableOn<K extends keyof T>(name: K, callback: Handler<T[K]>): () => void {
        this.on(name, callback);
        return () => {
            this.off(name, callback);
        }
    }

    on<K extends keyof T>(name: K, callback: Handler<T[K]>): void {
        let handlers = this._handlersByName[name];
        if (!handlers) {
            this.onFirstSubscriptionAdded(name);
            this._handlersByName[name] = handlers = new Set();
        }
        handlers.add(callback);
    }

    off<K extends keyof T>(name: K, callback: Handler<T[K]>): void {
        const handlers = this._handlersByName[name];
        if (handlers) {
            handlers.delete(callback);
            if (handlers.size === 0) {
                delete this._handlersByName[name];
                this.onLastSubscriptionRemoved(name);
            }
        }
    }

    onFirstSubscriptionAdded<K extends keyof T>(name: K): void {}

    onLastSubscriptionRemoved<K extends keyof T>(name: K): void {}
}

export function tests() {
    return {
        test_on_off(assert) {
            let counter = 0;
            const e = new EventEmitter<{ change: never }>();
            const callback = () => counter += 1;
            e.on("change", callback);
            e.emit("change");
            e.off("change", callback);
            e.emit("change");
            assert.equal(counter, 1);
        },

        test_emit_value(assert) {
            let value = 0;
            const e = new EventEmitter<{ change: number }>();
            const callback = (v) => value = v;
            e.on("change", callback);
            e.emit("change", 5);
            e.off("change", callback);
            assert.equal(value, 5);
        },

        test_double_on(assert) {
            let counter = 0;
            const e = new EventEmitter<{ change: never }>();
            const callback = () => counter += 1;
            e.on("change", callback);
            e.on("change", callback);
            e.emit("change");
            e.off("change", callback);
            assert.equal(counter, 1);
        }
    };
}
