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

import {BaseObservable} from "../BaseObservable";

export interface IListObserver<T> {
    onReset(list: BaseObservableList<T>): void;
    onAdd(index: number, value:T, list: BaseObservableList<T>): void;
    onUpdate(index: number, value: T, params: any, list: BaseObservableList<T>): void;
    onRemove(index: number, value: T, list: BaseObservableList<T>): void
    onMove(from: number, to: number, value: T, list: BaseObservableList<T>): void
}

export function defaultObserverWith<T>(overrides: { [key in keyof IListObserver<T>]?: IListObserver<T>[key] }): IListObserver<T> {
    const defaults = {
        onReset(): void {},
        onAdd(): void {},
        onUpdate(): void {},
        onRemove(): void {},
        onMove(): void {},
    };
    return Object.assign(defaults, overrides);
}

export abstract class BaseObservableList<T> extends BaseObservable<IListObserver<T>> implements Iterable<T> {
    emitReset(): void {
        for(let h of this._handlers) {
            h.onReset(this);
        }
    }
    // we need batch events, mostly on index based collection though?
    // maybe we should get started without?
    emitAdd(index: number, value: T): void {
        for(let h of this._handlers) {
            h.onAdd(index, value, this);
        }
    }

    emitUpdate(index: number, value: T, params?: any): void {
        for(let h of this._handlers) {
            h.onUpdate(index, value, params, this);
        }
    }

    emitRemove(index: number, value: T): void {
        for(let h of this._handlers) {
            h.onRemove(index, value, this);
        }
    }

    // toIdx assumes the item has already
    // been removed from its fromIdx
    emitMove(fromIdx: number, toIdx: number, value: T): void {
        for(let h of this._handlers) {
            h.onMove(fromIdx, toIdx, value, this);
        }
    }

    abstract [Symbol.iterator](): Iterator<T>;
    abstract get length(): number;
}
