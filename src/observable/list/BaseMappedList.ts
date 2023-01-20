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

import {BaseObservableList} from "./BaseObservableList";
import {findAndUpdateInArray} from "./common";

export type Mapper<F,T> = (value: F) => T
export type Updater<F,T> = (mappedValue: T, params: any, value: F) => void;

export class BaseMappedList<F,T,R = T> extends BaseObservableList<T> {
    protected _sourceList: BaseObservableList<F>;
    protected _sourceUnsubscribe: (() => void) | null = null;
    _mapper: Mapper<F,R>;
    _updater?: Updater<F,T>;
    _removeCallback?: (value: T) => void;
    _mappedValues: T[] | null = null;

    constructor(sourceList: BaseObservableList<F>, mapper: Mapper<F,R>, updater?: Updater<F,T>, removeCallback?: (value: T) => void) {
        super();
        this._sourceList = sourceList;
        this._mapper = mapper;
        this._updater = updater;
        this._removeCallback = removeCallback;
    }

    findAndUpdate(predicate: (value: T) => boolean, updater: (value: T) => any | false): boolean {
        return findAndUpdateInArray(predicate, this._mappedValues!, this, updater);
    }

    get length(): number {
        return this._mappedValues!.length;
    }

    [Symbol.iterator](): IterableIterator<T> {
        return this._mappedValues!.values();
    }
}

export function runAdd<F,T,R>(list: BaseMappedList<F,T,R>, index: number, mappedValue: T): void {
    list._mappedValues!.splice(index, 0, mappedValue);
    list.emitAdd(index, mappedValue);
}

export function runUpdate<F,T,R>(list: BaseMappedList<F,T,R>, index: number, value: F, params: any): void {
    const mappedValue = list._mappedValues![index];
    if (list._updater) {
        list._updater(mappedValue, params, value);
    }
    list.emitUpdate(index, mappedValue, params);
}

export function runRemove<F,T,R>(list: BaseMappedList<F,T,R>, index: number): void {
    const mappedValue = list._mappedValues![index];
    list._mappedValues!.splice(index, 1);
    if (list._removeCallback) {
        list._removeCallback(mappedValue);
    }
    list.emitRemove(index, mappedValue);
}

export function runMove<F,T,R>(list: BaseMappedList<F,T,R>, fromIdx: number, toIdx: number): void {
    const mappedValue = list._mappedValues![fromIdx];
    list._mappedValues!.splice(fromIdx, 1);
    list._mappedValues!.splice(toIdx, 0, mappedValue);
    list.emitMove(fromIdx, toIdx, mappedValue);
}

export function runReset<F,T,R>(list: BaseMappedList<F,T,R>): void {
    list._mappedValues = [];
    list.emitReset();
}
