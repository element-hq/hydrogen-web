/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
