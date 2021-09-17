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

import { StorageError } from "../../common";
import {KeyLimits} from "../../common";
import { encodeUint32 } from "../utils";
import {Store} from "../Store";

interface Fragment {
    roomId: string;
    id: number;
    previousId: number | null;
    nextId: number | null;
    previousToken: string | null;
    nextToken: string | null;
}

type FragmentEntry = Fragment & { key: string }

function encodeKey(roomId: string, fragmentId: number): string {
    return `${roomId}|${encodeUint32(fragmentId)}`;
}

export class TimelineFragmentStore {
    private _store: Store<FragmentEntry>;

    constructor(store: Store<FragmentEntry>) {
        this._store = store;
    }

    _allRange(roomId: string): IDBKeyRange {
        try {
            return this._store.IDBKeyRange.bound(
                encodeKey(roomId, KeyLimits.minStorageKey),
                encodeKey(roomId, KeyLimits.maxStorageKey)
            );
        } catch (err) {
            throw new StorageError(`error from IDBKeyRange with roomId ${roomId}`, err);
        }
    }

    all(roomId: string): Promise<FragmentEntry[]> {
        return this._store.selectAll(this._allRange(roomId));
    }

    /** Returns the fragment without a nextToken and without nextId,
    if any, with the largest id if there are multiple (which should not happen) */
    liveFragment(roomId: string): Promise<FragmentEntry | undefined> {
        // why do we need this?
        // Ok, take the case where you've got a /context fragment and a /sync fragment
        // They are not connected. So, upon loading the persister, which one do we take? We can't sort them ...
        // we assume that the one without a nextToken and without a nextId is a live one
        // there should really be only one like this

        // reverse because assuming live fragment has bigger id than non-live ones
        return this._store.findReverse(this._allRange(roomId), fragment => {
            return typeof fragment.nextId !== "number" && typeof fragment.nextToken !== "string";
        });
    }

    // should generate an id an return it?
    // depends if we want to do anything smart with fragment ids,
    // like give them meaning depending on range. not for now probably ...
    add(fragment: Fragment): void {
        (fragment as FragmentEntry).key = encodeKey(fragment.roomId, fragment.id);
        this._store.add(fragment as FragmentEntry);
    }

    update(fragment: FragmentEntry): void {
        this._store.put(fragment);
    }

    get(roomId: string, fragmentId: number): Promise<FragmentEntry | null> {
        return this._store.get(encodeKey(roomId, fragmentId));
    }

    removeAllForRoom(roomId: string): void {
        this._store.delete(this._allRange(roomId));
    }
}
