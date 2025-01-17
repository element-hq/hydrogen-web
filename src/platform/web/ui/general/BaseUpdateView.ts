/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.
Copyright 2021 Daniel Fedorin <danila.fedorin@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {IMountArgs, ViewNode, IView} from "./types";

export interface IObservableValue {
    on?(event: "change", handler: (props?: string[]) => void): void;
    off?(event: "change", handler: (props?: string[]) => void): void;
}

export abstract class BaseUpdateView<T extends IObservableValue> implements IView {
    protected _value: T
    protected _boundUpdateFromValue: ((props?: string[]) => void) | null

    abstract mount(args?: IMountArgs): ViewNode;
    abstract root(): ViewNode | undefined;
    abstract update(...any);

    constructor(value :T) {
        this._value = value;
        // TODO: can avoid this if we adopt the handleEvent pattern in our EventListener
        this._boundUpdateFromValue = null;
    }

    subscribeOnMount(options?: IMountArgs): void {
        const parentProvidesUpdates = options && options.parentProvidesUpdates;
        if (!parentProvidesUpdates) {
            this._subscribe();
        }
    }

    unmount(): void {
        this._unsubscribe();
    }

    get value(): T {
        return this._value;
    }

    _updateFromValue(changedProps?: string[]) {
        this.update(this._value, changedProps);
    }

    _subscribe(): void {
        if (typeof this._value?.on === "function") {
            this._boundUpdateFromValue = this._updateFromValue.bind(this) as (props?: string[]) => void;
            this._value.on("change", this._boundUpdateFromValue);
        }
    }

    _unsubscribe(): void {
        if (this._boundUpdateFromValue) {
            if (typeof this._value.off === "function") {
                this._value.off("change", this._boundUpdateFromValue);
            }
            this._boundUpdateFromValue = null;
        }
    }
}
