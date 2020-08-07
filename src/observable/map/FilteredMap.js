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

export class FilteredMap extends BaseObservableMap {
    constructor(source, mapper, updater) {
        super();
        this._source = source;
        this._mapper = mapper;
        this._updater = updater;
        this._mappedValues = new Map();
    }

    onAdd(key, value) {
        const mappedValue = this._mapper(value);
        this._mappedValues.set(key, mappedValue);
        this.emitAdd(key, mappedValue);
    }

    onRemove(key, _value) {
        const mappedValue = this._mappedValues.get(key);
        if (this._mappedValues.delete(key)) {
            this.emitRemove(key, mappedValue);
        }
    }

    onChange(key, value, params) {
        const mappedValue = this._mappedValues.get(key);
        if (mappedValue !== undefined) {
            const newParams = this._updater(value, params);
            if (newParams !== undefined) {
                this.emitChange(key, mappedValue, newParams);
            }
        }
    }

    onSubscribeFirst() {
        for (let [key, value] of this._source) {
            const mappedValue = this._mapper(value);
            this._mappedValues.set(key, mappedValue);
        }
        super.onSubscribeFirst();
    }

    onUnsubscribeLast() {
        super.onUnsubscribeLast();
        this._mappedValues.clear();
    }

    onReset() {
        this._mappedValues.clear();
        this.emitReset();
    }

    [Symbol.iterator]() {
        return this._mappedValues.entries()[Symbol.iterator];
    }
}
