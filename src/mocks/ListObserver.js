/*
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

export class ListObserver {
    constructor() {
        this._queuesPerType = new Map();
    }

    _nextEvent(type) {
        const queue = this._queuesPerType.get(type);
        if (!queue) {
            queue = [];
            this._queuesPerType.set(type, queue);
        }
        return new Promise(resolve => {
            queue.push(resolve);
        });
    }

    nextAdd() {
        return this._nextEvent("add");
    }

    nextUpdate() {
        return this._nextEvent("update");
    }

    nextRemove() {
        return this._nextEvent("remove");
    }

    nextMove() {
        return this._nextEvent("move");
    }

    nextReset() {
        return this._nextEvent("reset");
    }

    _popQueue(type) {
        const queue = this._queuesPerType.get(type);
        return queue?.unshift();
    }

    onReset(list) {
        const resolve = this._popQueue("reset");
        resolve && resolve();
    }
    
    onAdd(index, value) {
        const resolve = this._popQueue("add");
        resolve && resolve({index, value});
    }
    
    onUpdate(index, value, params) {
        const resolve = this._popQueue("update");
        resolve && resolve({index, value, params});
    }
    
    onRemove(index, value) {
        const resolve = this._popQueue("remove");
        resolve && resolve({index, value});
    }

    onMove(fromIdx, toIdx, value) {
        const resolve = this._popQueue("move");
        resolve && resolve({fromIdx, toIdx, value});
    }
}
