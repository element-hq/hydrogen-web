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

import {BaseObservableList} from "./BaseObservableList.js";
import {findAndUpdateInArray} from "./common.js";

export class BaseMappedList extends BaseObservableList {
    constructor(sourceList, mapper, updater, removeCallback) {
        super();
        this._sourceList = sourceList;
        this._mapper = mapper;
        this._updater = updater;
        this._removeCallback = removeCallback;
        this._mappedValues = null;
        this._sourceUnsubscribe = null;
    }

    findAndUpdate(predicate, updater) {
        return findAndUpdateInArray(predicate, this._mappedValues, this, updater);
    }

    get length() {
        return this._mappedValues.length;
    }

    [Symbol.iterator]() {
        return this._mappedValues.values();
    }
}

export function runAdd(list, index, mappedValue) {
    list._mappedValues.splice(index, 0, mappedValue);
    list.emitAdd(index, mappedValue);
}

export function runUpdate(list, index, value, params) {
    const mappedValue = list._mappedValues[index];
    if (list._updater) {
        list._updater(mappedValue, params, value);
    }
    list.emitUpdate(index, mappedValue, params);
}

export function runRemove(list, index) {
    const mappedValue = list._mappedValues[index];
    list._mappedValues.splice(index, 1);
    if (list._removeCallback) {
        list._removeCallback(mappedValue);
    }
    list.emitRemove(index, mappedValue);
}

export function runMove(list, fromIdx, toIdx) {
    const mappedValue = list._mappedValues[fromIdx];
    list._mappedValues.splice(fromIdx, 1);
    list._mappedValues.splice(toIdx, 0, mappedValue);
    list.emitMove(fromIdx, toIdx, mappedValue);
}

export function runReset(list) {
    list._mappedValues = [];
    list.emitReset();
}
