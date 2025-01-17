/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {EventEmitter} from "../utils/EventEmitter";

export interface IAbortable {
    abort();
}

export type SetAbortableFn = (a: IAbortable) => typeof a;
export type SetProgressFn<P> = (progress: P) => void;
type RunFn<T, P> = (setAbortable: SetAbortableFn, setProgress: SetProgressFn<P>) => T;

export class AbortableOperation<T, P = void> extends EventEmitter<{change: keyof AbortableOperation<T, P>}> implements IAbortable {
    public readonly result: T;
    private _abortable?: IAbortable;
    private _progress?: P;

    constructor(run: RunFn<T, P>) {
        super();
        this._abortable = undefined;
        const setAbortable: SetAbortableFn = abortable => {
            this._abortable = abortable;
            return abortable;
        };
        this._progress = undefined;
        const setProgress: SetProgressFn<P> = (progress: P) => {
            this._progress = progress;
            this.emit("change", "progress");
        };
        this.result = run(setAbortable, setProgress);
    }

    get progress(): P | undefined {
        return this._progress;
    }

    abort() {
        this._abortable?.abort();
        this._abortable = undefined;
    }
}
