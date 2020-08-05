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

import {BaseObservable} from "../BaseObservable.js";

export class BaseObservableList extends BaseObservable {
    emitReset() {
        for(let h of this._handlers) {
            h.onReset(this);
        }
    }
    // we need batch events, mostly on index based collection though?
    // maybe we should get started without?
    emitAdd(index, value) {
        for(let h of this._handlers) {
            h.onAdd(index, value, this);
        }
    }

    emitUpdate(index, value, params) {
        for(let h of this._handlers) {
            h.onUpdate(index, value, params, this);
        }
    }

    emitRemove(index, value) {
        for(let h of this._handlers) {
            h.onRemove(index, value, this);
        }
    }

    // toIdx assumes the item has already
    // been removed from its fromIdx
    emitMove(fromIdx, toIdx, value) {
        for(let h of this._handlers) {
            h.onMove(fromIdx, toIdx, value, this);
        }
    }

    [Symbol.iterator]() {
        throw new Error("unimplemented");
    }

    get length() {
        throw new Error("unimplemented");
    }
}
