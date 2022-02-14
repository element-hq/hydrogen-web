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

export class LogMap extends BaseObservableMap {
    constructor(source, log) {
        super();
        this._source = source;
        this.log = log;
        this._subscription = null;
    }

    onAdd(key, value) {
        this.log("add", key, value);
        this.emitAdd(key, value);
    }

    onRemove(key, value) {
        this.log("remove", key, value);
        this.emitRemove(key, value);
    }

    onUpdate(key, value, params) {
        this.log("update", key, value, params);
        this.emitUpdate(key, value, params);
    }

    onSubscribeFirst() {
        this.log("subscribeFirst");
        this._subscription = this._source.subscribe(this);
        super.onSubscribeFirst();
    }

    onUnsubscribeLast() {
        super.onUnsubscribeLast();
        this._subscription = this._subscription();
        this.log("unsubscribeLast");
    }

    onReset() {
        this.log("reset");
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
