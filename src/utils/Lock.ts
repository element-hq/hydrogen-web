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

export class Lock {
    private _promise?: Promise<void>;
    private _resolve?: (() => void);

    tryTake(): boolean {
        if (!this._promise) {
            this._promise = new Promise(resolve => {
                this._resolve = resolve;
            });
            return true;
        }
        return false;
    }

    async take(): Promise<void> {
        while(!this.tryTake()) {
            await this.released();
        }
    }

    get isTaken(): boolean {
        return !!this._promise;
    }

    release(): void {
        if (this._resolve) {
            this._promise = undefined;
            const resolve = this._resolve;
            this._resolve = undefined;
            resolve();
        }
    }

    released(): Promise<void> | undefined {
        return this._promise;
    }
}

export class MultiLock {

    constructor(public readonly locks: Lock[]) {
    }

    release(): void {
        for (const lock of this.locks) {
            lock.release();
        }
    }
}

export function tests() {
    return {
        "taking a lock twice returns false": assert => {
            const lock = new Lock();
            assert.equal(lock.tryTake(), true);
            assert.equal(lock.isTaken, true);
            assert.equal(lock.tryTake(), false);
        },
        "can take a released lock again": assert => {
            const lock = new Lock();
            lock.tryTake();
            lock.release();
            assert.equal(lock.isTaken, false);
            assert.equal(lock.tryTake(), true);
        },
        "2 waiting for lock, only first one gets it": async assert => {
            const lock = new Lock();
            lock.tryTake();

            let first;
            lock.released()!.then(() => first = lock.tryTake());
            let second;
            lock.released()!.then(() => second = lock.tryTake());
            const promise = lock.released();
            lock.release();
            await promise;
            assert.strictEqual(first, true);
            assert.strictEqual(second, false);
        },
        "await non-taken lock": async assert => {
            const lock = new Lock();
            await lock.released();
            assert(true);
        }
    }
}
