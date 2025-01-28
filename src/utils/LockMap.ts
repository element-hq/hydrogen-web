/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {Lock} from "./Lock";

export class LockMap<T> {
    private readonly _map: Map<T, Lock> = new Map();

    async takeLock(key: T): Promise<Lock> {
        let lock = this._map.get(key);
        if (lock) {
            await lock.take();
        } else {
            lock = new Lock();
            lock.tryTake();
            this._map.set(key, lock);
        }
        // don't leave old locks lying around
        lock.released()!.then(() => {
            // give others a chance to take the lock first
            Promise.resolve().then(() => {
                if (!lock!.isTaken) {
                    this._map.delete(key);
                }
            });
        });
        return lock;
    }
}

export function tests() {
    return {
        "taking a lock on the same key blocks": async assert => {
            const lockMap = new LockMap();
            const lock = await lockMap.takeLock("foo");
            let second = false;
            const prom = lockMap.takeLock("foo").then(() => {
                second = true;
            });
            assert.equal(second, false);
            // do a delay to make sure prom does not resolve on its own
            await Promise.resolve();
            lock.release();
            await prom;
            assert.equal(second, true);
        },
        "lock is not cleaned up with second request": async assert => {
            const lockMap = new LockMap();
            const lock = await lockMap.takeLock("foo");
            let ranSecond = false;
            const prom = lockMap.takeLock("foo").then(returnedLock => {
                ranSecond = true;
                assert.equal(returnedLock.isTaken, true);
                // peek into internals, naughty
                // @ts-ignore
                assert.equal(lockMap._map.get("foo"), returnedLock);
            });
            lock.release();
            await prom;
            // double delay to make sure cleanup logic ran
            await Promise.resolve();
            await Promise.resolve();
            assert.equal(ranSecond, true);
        },
        "lock is cleaned up without other request": async assert => {
            const lockMap = new LockMap();
            const lock = await lockMap.takeLock("foo");
            await Promise.resolve();
            lock.release();
            // double delay to make sure cleanup logic ran
            await Promise.resolve();
            await Promise.resolve();
            // @ts-ignore
            assert.equal(lockMap._map.has("foo"), false);
        },
        
    };
}
