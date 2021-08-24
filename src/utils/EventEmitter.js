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

export class EventEmitter {
    constructor() {
        this._handlersByName = {};
    }

    emit(name, ...values) {
        const handlers = this._handlersByName[name];
        if (handlers) {
            for(const h of handlers) {
                h(...values);
            }
        }
    }

    disposableOn(name, callback) {
        this.on(name, callback);
        return () => {
            this.off(name, callback);
        }
    }

    on(name, callback) {
        let handlers = this._handlersByName[name];
        if (!handlers) {
            this.onFirstSubscriptionAdded(name);
            this._handlersByName[name] = handlers = new Set();
        }
        handlers.add(callback);
    }

    off(name, callback) {
        const handlers = this._handlersByName[name];
        if (handlers) {
            handlers.delete(callback);
            if (handlers.length === 0) {
                delete this._handlersByName[name];
                this.onLastSubscriptionRemoved(name);
            }
        }
    }

    onFirstSubscriptionAdded(/* name */) {}

    onLastSubscriptionRemoved(/* name */) {}
}

export function tests() {
    return {
        test_on_off(assert) {
            let counter = 0;
            const e = new EventEmitter();
            const callback = () => counter += 1;
            e.on("change", callback);
            e.emit("change");
            e.off("change", callback);
            e.emit("change");
            assert.equal(counter, 1);
        },

        test_emit_value(assert) {
            let value = 0;
            const e = new EventEmitter();
            const callback = (v) => value = v;
            e.on("change", callback);
            e.emit("change", 5);
            e.off("change", callback);
            assert.equal(value, 5);
        },

        test_double_on(assert) {
            let counter = 0;
            const e = new EventEmitter();
            const callback = () => counter += 1;
            e.on("change", callback);
            e.on("change", callback);
            e.emit("change");
            e.off("change", callback);
            assert.equal(counter, 1);
        }
    };
}
