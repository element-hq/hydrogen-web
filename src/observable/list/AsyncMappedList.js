/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {BaseMappedList, runAdd, runUpdate, runRemove, runMove, runReset} from "./BaseMappedList";

export class AsyncMappedList extends BaseMappedList {
    constructor(sourceList, mapper, updater, removeCallback) {
        super(sourceList, mapper, updater, removeCallback);
        this._eventQueue = null;
    }

    onSubscribeFirst() {
        this._sourceUnsubscribe = this._sourceList.subscribe(this);
        this._eventQueue = [];
        this._mappedValues = [];
        let idx = 0;
        for (const item of this._sourceList) {
            this._eventQueue.push(new AddEvent(idx, item));
            idx += 1;
        }
        this._flush();
    }

    async _flush() {
        if (this._flushing) {
            return;
        }
        this._flushing = true;
        try {
            while (this._eventQueue.length) {
                const event = this._eventQueue.shift();
                await event.run(this);
            }
        } finally {
            this._flushing = false;
        }
    }

    onReset() {
        if (this._eventQueue) {
            this._eventQueue.push(new ResetEvent());
            this._flush();
        }
    }

    onAdd(index, value) {
        if (this._eventQueue) {
            this._eventQueue.push(new AddEvent(index, value));
            this._flush();
        }
    }

    onUpdate(index, value, params) {
        if (this._eventQueue) {
            this._eventQueue.push(new UpdateEvent(index, value, params));
            this._flush();
        }
    }

    onRemove(index) {
        if (this._eventQueue) {
            this._eventQueue.push(new RemoveEvent(index));
            this._flush();
        }
    }

    onMove(fromIdx, toIdx) {
        if (this._eventQueue) {
            this._eventQueue.push(new MoveEvent(fromIdx, toIdx));
            this._flush();
        }
    }

    onUnsubscribeLast() {
        this._sourceUnsubscribe();
        this._eventQueue = null;
        this._mappedValues = null;
    }
}

class AddEvent {
    constructor(index, value) {
        this.index = index;
        this.value = value;
    }

    async run(list) {
        const mappedValue = await list._mapper(this.value);
        runAdd(list, this.index, mappedValue);
    }
}

class UpdateEvent {
    constructor(index, value, params) {
        this.index = index;
        this.value = value;
        this.params = params;
    }

    async run(list) {
        runUpdate(list, this.index, this.value, this.params);
    }
}

class RemoveEvent {
    constructor(index) {
        this.index = index;
    }

    async run(list) {
        runRemove(list, this.index);
    }
}

class MoveEvent {
    constructor(fromIdx, toIdx) {
        this.fromIdx = fromIdx;
        this.toIdx = toIdx;
    }

    async run(list) {
        runMove(list, this.fromIdx, this.toIdx);
    }
}

class ResetEvent {
    async run(list) {
        runReset(list);
    }
}

import {ObservableArray} from "./ObservableArray.js";
import {ListObserver} from "../../mocks/ListObserver.js";

export function tests() {
    return {
        "events are emitted in order": async assert => {
            const double = n => n * n;
            const source = new ObservableArray();
            const mapper = new AsyncMappedList(source, async n => {
                await new Promise(r => setTimeout(r, n));
                return {n: double(n)};
            }, (o, params, n) => {
                o.n = double(n);
            });
            const observer = new ListObserver();
            mapper.subscribe(observer);
            source.append(2); // will sleep this amount, so second append would take less time
            source.append(1);
            source.update(0, 7, "lucky seven")
            source.remove(0);
            {
                const {type, index, value} = await observer.next();
                assert.equal(mapper.length, 1);
                assert.equal(type, "add");
                assert.equal(index, 0);
                assert.equal(value.n, 4);
            }
            {
                const {type, index, value} = await observer.next();
                assert.equal(mapper.length, 2);
                assert.equal(type, "add");
                assert.equal(index, 1);
                assert.equal(value.n, 1);
            }
            {
                const {type, index, value, params} = await observer.next();
                assert.equal(mapper.length, 2);
                assert.equal(type, "update");
                assert.equal(index, 0);
                assert.equal(value.n, 49);
                assert.equal(params, "lucky seven");
            }
            {
                const {type, index, value} = await observer.next();
                assert.equal(mapper.length, 1);
                assert.equal(type, "remove");
                assert.equal(index, 0);
                assert.equal(value.n, 49);
            }
        }
    }
}
