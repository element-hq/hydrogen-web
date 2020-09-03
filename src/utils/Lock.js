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
    constructor() {
        this._promise = null;
        this._resolve = null;
    }

    take() {
        if (!this._promise) {
            this._promise = new Promise(resolve => {
                this._resolve = resolve;
            });
            return true;
        }
        return false;
    }

    get isTaken() {
        return !!this._promise;
    }

    release() {
        if (this._resolve) {
            this._promise = null;
            const resolve = this._resolve;
            this._resolve = null;
            resolve();
        }
    }

    released() {
        return this._promise;
    }
}

export function tests() {
    return {
        "taking a lock twice returns false": assert => {
            const lock = new Lock();
            assert.equal(lock.take(), true);
            assert.equal(lock.isTaken, true);
            assert.equal(lock.take(), false);
        },
        "can take a released lock again": assert => {
            const lock = new Lock();
            lock.take();
            lock.release();
            assert.equal(lock.isTaken, false);
            assert.equal(lock.take(), true);
        },
        "2 waiting for lock, only first one gets it": async assert => {
            const lock = new Lock();
            lock.take();

            let first;
            lock.released().then(() => first = lock.take());
            let second;
            lock.released().then(() => second = lock.take());
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
