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

import {BaseObservableMap} from "./BaseObservableMap.js";

export class ApplyMap extends BaseObservableMap {
    constructor(source, apply) {
        super();
        this._source = source;
        this._apply = apply;
        this._subscription = null;
    }

    hasApply() {
        return !!this._apply;
    }

    setApply(apply) {
        this._apply = apply;
        if (apply) {
            this.applyOnce(this._apply);
        }
    }

    applyOnce(apply) {
        for (const [key, value] of this._source) {
            apply(key, value);
        }
    }

    onAdd(key, value) {
        if (this._apply) {
            this._apply(key, value);
        }
        this.emitAdd(key, value);
    }

    onRemove(key, value) {
        this.emitRemove(key, value);
    }

    onUpdate(key, value, params) {
        if (this._apply) {
            this._apply(key, value, params);
        }
        this.emitUpdate(key, value, params);
    }

    onSubscribeFirst() {
        this._subscription = this._source.subscribe(this);
        if (this._apply) {
            this.applyOnce(this._apply);
        }
        super.onSubscribeFirst();
    }

    onUnsubscribeLast() {
        super.onUnsubscribeLast();
        this._subscription = this._subscription();
    }

    onReset() {
        if (this._apply) {
            this.applyOnce(this._apply);
        }
        this.emitReset();
    }

    [Symbol.iterator]() {
        return this._source[Symbol.iterator]();
    }

    get size() {
        return this._source.size;
    }

    get(key) {
        return this._source.get(key);
    }
}
