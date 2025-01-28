/*
Copyright 2025 New Vector Ltd.
Copyright 2021 Daniel Fedorin <danila.fedorin@gmail.com>
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
