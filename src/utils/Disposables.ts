/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2022 The Matrix.org Foundation C.I.C.

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

export interface IDisposable {
    dispose(): void;
}

export type Disposable = IDisposable | (() => void);

function disposeValue(value: Disposable): void {
    if (typeof value === "function") {
        value();
    } else {
        value.dispose();
    }
}

function isDisposable(value: Disposable): boolean {
    return value && (typeof value === "function" || typeof value.dispose === "function");
}

export class Disposables {
    private _disposables?: Disposable[] = [];

    track<D extends Disposable>(disposable: D): D {
        if (!isDisposable(disposable)) {
            throw new Error("Not a disposable");
        }
        if (this.isDisposed) {
            console.warn("Disposables already disposed, disposing new value");
            disposeValue(disposable);
            return disposable;
        }
        this._disposables!.push(disposable);
        return disposable;
    }

    untrack(disposable: Disposable): undefined {
        // already disposed
        if (!this._disposables) {
            return undefined;
        }
        const idx = this._disposables!.indexOf(disposable);
        if (idx >= 0) {
            this._disposables!.splice(idx, 1);
        }
        return undefined;
    }

    dispose(): void {
        if (this._disposables) {
            for (const d of this._disposables) {
                disposeValue(d);
            }
            this._disposables = undefined;
        }
    }

    get isDisposed(): boolean {
        return this._disposables === undefined;
    }

    disposeTracked(value: Disposable | undefined): undefined {
        if (value === undefined || value === null || this.isDisposed) {
            return undefined;
        }
        const idx = this._disposables!.indexOf(value);
        if (idx !== -1) {
            const [foundValue] = this._disposables!.splice(idx, 1);
            disposeValue(foundValue);
        } else {
            console.warn("disposable not found, did it leak?", value);
        }
        return undefined;
    }
}
