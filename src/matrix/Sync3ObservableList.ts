/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import * as assert from "assert";
import { BaseObservableList } from "../observable/list/BaseObservableList";
import { ObservableMap } from "../observable/map/ObservableMap.js";
import { Room } from "./room/Room.js";

// subset of Sync3 functions used in this list; interfaced out for testing
interface ISync {
    count(): number;
    roomAtIndex(i: number): string
}

/**
 * An observable list that produces a subset of rooms based on Sync3 responses.
 */
export class Sync3ObservableList extends BaseObservableList<Room | null> {
    sync: ISync;
    rooms: ObservableMap;

    /**
     * Construct an observable list that produces Rooms within the sliding window of Sync3 responses
     * or `null` to indicate that a placeholder room should be used.
     * @param sync3 The Sync3 class, which tracks up-to-date information on the sliding window / room counts.
     * @param rooms The entire set of rooms known to the client (e.g from Session.rooms).
     */
    constructor(sync3: ISync, rooms: ObservableMap) {
        super();
        this.sync = sync3;
        this.rooms = rooms;
    }

    get length(): number {
        return this.sync.count();
    }

    [Symbol.iterator](): Iterator<Room | null, any, undefined> {
        let i = 0;
        return {
            next: (): any => {
                // base case
                if (i >= this.length) {
                    return {
                        done: true,
                    };
                }
                let roomId = this.sync.roomAtIndex(i);
                i += 1;
                if (!roomId) {
                    return {
                        value: null
                    }
                }
                return {
                    value: this.rooms.get(roomId) || null,
                }
            }
        }
    }
}

export function tests() {
    const makeRooms = function (len) {
        let rooms: any[] = [];
        for (let i = 0; i < len; i++) {
            const roomId = "!room-" + i;
            rooms.push({
                id: roomId,
                data: {
                    some_key: i,
                },
            });
        }
        return rooms;
    }

    const assertList = function (assert, rooms, gotList, wantListRoomIds) {
        assert.equal(wantListRoomIds.length, gotList.length);
        if (wantListRoomIds.length === 0) {
            for (const room of gotList) {
                assert.equal(0, 1); // fail
            }
            return;
        }
        let i = 0;
        for (const room of gotList) {
            const wantRoomId = wantListRoomIds[i];
            const gotRoomId = room ? room.id : null;
            assert.strictEqual(wantRoomId, gotRoomId);
            if (wantRoomId !== null && gotRoomId !== null) {
                assert.deepEqual(room, rooms.get(wantRoomId));
            }
            i += 1;
        }
    }

    return {
        "iterator": (assert) => {
            const rooms = new ObservableMap();
            let indexToRoomId = {};
            let roomCount = 0;
            const sync3 = {
                count: (): number => {
                    return roomCount;
                },
                roomAtIndex: (i: number): string => {
                    return indexToRoomId[i];
                },
            };

            makeRooms(100).forEach((r) => {
                rooms.add(r.id, r);
            });
            const list = new Sync3ObservableList(sync3, rooms);

            // iterate over the list (0 items) as sync3 has no indexes for the rooms
            assertList(assert, rooms, list, []);


            // 'load' 5 rooms from sync v3 and set the total count to 5 so we load the entire room list in one go!
            // [R,R,R,R,R]
            let slidingWindow: any[] = [
                "!room-50", "!room-53", "!room-1", "!room-52", "!room-97"
            ]
            roomCount = 5;
            for (let i = 0; i < slidingWindow.length; i++) {
                indexToRoomId[i] = slidingWindow[i];
            }
            assertList(assert, rooms, list, slidingWindow);

            // now add 5 more rooms which we don't know about, we should iterate through them with `null` entries
            // [R,R,R,R,R,P,P,P,P,P] (R=room, P=placeholder)
            roomCount = 10;
            assertList(assert, rooms, list, slidingWindow.concat([null, null, null, null, null]));


            // now track a window in the middle of the list (5-10)
            indexToRoomId = {};
            for (let i = 0; i < slidingWindow.length; i++) {
                indexToRoomId[i + 5] = slidingWindow[i];
            }
            roomCount = 15;
            // [P,P,P,P,P,R,R,R,R,R,P,P,P,P,P]
            assertList(assert, rooms, list, [null, null, null, null, null].concat(slidingWindow.concat([null, null, null, null, null])));


            // now track multiple ranges
            const anotherSlidingWindow: any[] = [
                "!room-30", "!room-33", "!room-36", "!room-29", "!room-21"
            ]
            for (let i = 0; i < anotherSlidingWindow.length; i++) {
                indexToRoomId[i + 15] = anotherSlidingWindow[i];
            }
            roomCount = 20;
            // [P,P,P,P,P,R,R,R,R,R,P,P,P,P,P,R,R,R,R,R]
            assertList(
                assert, rooms, list,
                [null, null, null, null, null].concat(
                    slidingWindow.concat(
                        [null, null, null, null, null].concat(
                            anotherSlidingWindow
                        )
                    )
                )
            );

        },
    };
};