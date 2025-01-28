/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
