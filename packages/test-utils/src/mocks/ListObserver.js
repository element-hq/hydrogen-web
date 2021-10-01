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
        this._queue = [];
        this._backlog = [];
    }

    next() {
        if (this._backlog.length) {
            return Promise.resolve(this._backlog.shift());
        } else {
            return new Promise(resolve => {
                this._queue.push(resolve);
            });
        }
    }

    _fullfillNext(value) {
        if (this._queue.length) {
            const resolve = this._queue.shift();
            resolve(value);
        } else {
            this._backlog.push(value);
        }
    }

    onReset() {
        this._fullfillNext({type: "reset"});
    }
    
    onAdd(index, value) {
        this._fullfillNext({type: "add", index, value});
    }
    
    onUpdate(index, value, params) {
        this._fullfillNext({type: "update", index, value, params});
    }
    
    onRemove(index, value) {
        this._fullfillNext({type: "remove", index, value});
    }

    onMove(fromIdx, toIdx, value) {
        this._fullfillNext({type: "move", fromIdx, toIdx, value});
    }
}
