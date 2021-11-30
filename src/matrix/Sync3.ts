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

import { ObservableValue } from "../observable/ObservableValue";
import { HomeServerApi } from "./net/HomeServerApi.js";
import { HomeServerRequest } from "./net/HomeServerRequest.js";
import { Storage } from "./storage/idb/Storage";
import { Session } from "./Session";
import { ILogger } from "../logging/types";

/*
 * This file contains the logic to perform sync v3 requests and massage the response into a format
 * which Hydrogen will accept. If you're reading this then you probably have the unfortunate job
 * of merging the sync-v3 branch into mainline Hydrogen. There will be copious comments in this file
 * to guide the reader to explain the "why?" of this code - some assumptions made as of this writing
 * may no longer be valid. Use your judgement. To that end, this work is based on the following
 * version of the sync v3 server: https://github.com/matrix-org/sync-v3/blob/398fc1ec6c67226b7817844074f7c51c3bcfa454/api.md
 * Please read that document which explains how Sync v3 works as the comments in this file will not
 * repeat content in that link.
 */

// sync v2 code has this so we probably want something similar, though v3 has no concept of a catchup
// sync hence it isn't here.
export enum SyncStatus {
    InitialSync, // valid: on startup until the first response. Request has no ?pos=
    Syncing, // valid: after the first response. Requests have a ?pos=
    Stopped, // valid: when code explicitly calls stop()
};

// Request types are below: See api.md for what these fields mean.

interface Sync3List {
    rooms: number[][];
    timeline_limit?: number;
    required_state?: string[][];
    sort?: string[];
};

interface RoomSubscriptionRequest {
    timeline_limit?: number;
    required_state?: string[][];
};

type RoomSubscriptionsRequest = {
    [roomId: string]: RoomSubscriptionRequest
};

interface Sync3RequestBody {
    session_id: string;
    lists: Sync3List[];
    room_subscriptions?: RoomSubscriptionsRequest;
};

// Response types are below: See api.md for what these fields mean.

// A sync v3 response body from the API
interface Sync3Response {
    room_subscriptions: RoomSubscriptions;
    ops: Op[];
    counts: number[];
    pos: number;
};

interface Op {
    list: number;
    op: string;
    range?: number[]; // only valid for SYNC, INVALIDATE
    rooms?: RoomResponse[]; // only valid for SYNC, INVALIDATE
    index?: number; // only valid for INSERT, UPDATE, DELETE
    room?: RoomResponse // only valid for INSERT, UPDATE
};

type RoomSubscriptions = {
    [roomId: string]: RoomResponse
};

interface RoomResponse {
    room_id: string;
    name: string;
    required_state: any[];
    timeline: any[];
    notification_count: number;
    highlight_count: number;
};

type IndexToRoomId = {
    [index: number]: string;
};
type RoomIdToIndex = {
    [roomId: string]: number;
}

export class Sync3 {
    private hsApi: HomeServerApi;
    private logger: ILogger;
    private session: Session;
    private storage: Storage;
    private currentRequest?: HomeServerRequest;

    // sync v3 specific: contains the sliding window ranges to request
    private ranges: number[][];
    private roomIndexToRoomId: IndexToRoomId;
    private roomIdToRoomIndex: RoomIdToIndex;

    public error?: any;
    public status: ObservableValue<SyncStatus>;

    // same params as sync v2
    constructor(hsApi: HomeServerApi, session: Session, storage: Storage, logger: ILogger) {
        this.hsApi = hsApi;
        this.logger = logger;
        this.session = session;
        this.storage = storage;
        this.currentRequest = null;
        this.status = new ObservableValue(SyncStatus.Stopped);
        this.error = null;
        // Hydrogen only has 1 list currently (no DM section) so we only need 1 range
        this.ranges = [[0, 49]];
        this.roomIndexToRoomId = {};
        this.roomIdToRoomIndex = {};
    }

    // Start syncing. Probably call this at startup once you have an access_token.
    // If we're already syncing, this does nothing.
    start(): void {
        if (this.status.get() !== SyncStatus.Stopped) {
            return;
        }
        this.error = null;
        this.status.set(SyncStatus.InitialSync);
        this.syncLoop(undefined);
    }

    stop() {
        if (this.status.get() === SyncStatus.Stopped) {
            return;
        }
        this.status.set(SyncStatus.Stopped);
        if (this.currentRequest) {
            this.currentRequest.abort();
            this.currentRequest = null;
        }
    }

    compare(roomIdA: string, roomIdB: string) {
        if (roomIdA === roomIdB) {
            return 0;
        }
        const indexA = this.roomIdToRoomIndex[roomIdA];
        const indexB = this.roomIdToRoomIndex[roomIdB];
        if (indexA === undefined || indexB === undefined) {
            console.error("sync3 cannot compare: missing indices for rooms", roomIdA, roomIdB, indexA, indexB);
        }
        if (indexA < indexB) {
            return -1;
        }
        return 1;
    }

    // The purpose of this function is to do repeated /sync calls and call processResponse. It doesn't
    // know or care how to handle the response, it only cares about the position and retries.
    private async syncLoop(pos?: number) {
        // In sync v2 a user can have many devices and each device has a single access token.
        // In sync v3 it's the same but IN ADDITION a single device can have many sessions.
        // This exists to fix to-device msgs being deleted prematurely caused by implicit ACKs.
        // Ergo, we need to specify a session ID when we start and provide it on all our requests.
        const sessionId = new Date().getTime() + "";

        // Set this too low and we'll do many more needless sync requests which consume bandwidth when there's no traffic.
        // Set this too high and intermediate proxies may knife the request causing failed requests.
        const timeoutSecs = 30;

        // track the number of times we've failed to work out how long to wait between requests
        let backoffCounter = 0;

        while (this.status.get() !== SyncStatus.Stopped) {
            let isFirstSync = this.status.get() === SyncStatus.InitialSync;
            const list: Sync3List = {
                rooms: this.ranges, // always provide the sliding window ranges
            };
            if (isFirstSync) {
                // add in sticky params, these are set once (initially) and then can be omitted and
                // the server will remember them (hence 'sticky').
                list.sort = ["by_highlight_count", "by_notification_count", "by_recency"];
                list.timeline_limit = 20;
                list.required_state = [
                    ["m.room.avatar", ""],
                ]
            }
            const requestBody: Sync3RequestBody = {
                session_id: sessionId,
                lists: [list],
            };
            try {
                await sleep(100);
                let resp: Sync3Response;
                this.currentRequest = await this.hsApi.sync3(requestBody, pos);
                resp = await this.currentRequest.response();
                backoffCounter = 0;
                // we have to wait for some parts of the response to be saved to disk before we can go on
                // hence the await.
                await this.processResponse(isFirstSync, resp);
                // increment our position to tell the server we got everything, similar to using ?since= in v2
                pos = resp.pos;
                if (isFirstSync) {
                    this.status.set(SyncStatus.Syncing);
                }
            } catch (err) {
                // we can be aborted if the ranges change and we need to re-request
                if (err.name === "AbortError") {
                    // we can also be aborted if we are explicitly stopped, in which case bail out.
                    if (this.status.get() == SyncStatus.Stopped) {
                        return;
                    }
                    continue;
                }
                // TODO: if HTTP 401 then log the user out

                // if we're here then another error happened like they lost connectivity or the server
                // got overloaded. Back off exponentially: 2>4>8>16>32s. Cap at 32s (2^5)
                backoffCounter += 1;
                if (backoffCounter > 5) {
                    backoffCounter = 5;
                }
                const secs = Math.pow(2, backoffCounter);
                console.log(`v3 /sync failed, backing off for ${secs}s`)
                await sleep(secs * 1000);
            }
        }
    }

    // The purpose of this function is process the /sync response and atomically update sync state.
    private async processResponse(isFirstSync: boolean, resp: Sync3Response) {
        console.log(resp);
        let { indexToRoom, updates } = this.processOps(resp.ops);

        let rooms: any[] = [];
        // process the room updates: new rooms, new timeline events, updated room names, that sort of thing.
        // we're kinda forced to use the logger as most functions expect an ILogItem
        await this.logger.run("sync3", async log => {
            const syncTxn = await this.openSyncTxn();
            try {
                // session.prepareSync // E2EE decrypts room keys
                // this.session.writeSync()  // write account data, device lists, etc.
                await Promise.all(updates.map(async (roomResponse) => {
                    // get or create a room
                    let room = this.session.rooms.get(roomResponse.room_id);
                    if (!room) {
                        room = this.session.createRoom(roomResponse.room_id);
                    } else {
                        await room.load(null, syncTxn, log);
                    }
                    const invite = {
                        isDirectMessage: false,
                        inviter: { userId: null },
                    };
                    // inject a fake m.room.name event if there isn't a real m.room.name event there already
                    roomResponse.required_state = roomResponse.required_state || [];
                    if (roomResponse.name) {
                        roomResponse.required_state.push({
                            event_id: "$name" + roomResponse.room_id,
                            content: {
                                name: roomResponse.name,
                            },
                            type: "m.room.name",
                            state_key: "",
                            sender: "@noone",
                            room_id: roomResponse.room_id,
                        })
                    }

                    const roomv2Response = {
                        timeline: {
                            events: roomResponse.timeline,
                        },
                        state: {
                            events: roomResponse.required_state,
                        },
                        account_data: null,
                        summary: null,
                        unread_notifications: {
                            notification_count: roomResponse.notification_count,
                            highlight_count: roomResponse.highlight_count,
                        },
                    }
                    // newKeys = [] (null for now)
                    const preparation = await room.prepareSync(
                        roomv2Response, "join", invite, null, syncTxn, log,
                    );
                    await room.afterPrepareSync(preparation, log);
                    const changes = await room.writeSync(
                        roomv2Response, isFirstSync, preparation, syncTxn, log
                    )
                    rooms.push({
                        room: room,
                        changes: changes,
                    });
                }))
            } catch (err) {
                // avoid corrupting state by only
                // storing the sync up till the point
                // the exception occurred
                syncTxn.abort(log);
                throw syncTxn.getCause(err);
            }
            await syncTxn.complete(log);

            // Sync v3 specific
            // atomically move all the rooms to their new positions
            // We need to do this BEFORE calling afterSync as that causes the room list to be sorted
            // which eventually causes Sync3.compare to be called, so we need it to be using the latest
            // sort positions by that point in time.
            this.roomIndexToRoomId = indexToRoom;
            this.roomIdToRoomIndex = {};
            Object.keys(indexToRoom).forEach((indexStr) => {
                const index = Number(indexStr);
                this.roomIdToRoomIndex[indexToRoom[index]] = index;
            });

            // update in-memory structs
            // this.session.afterSync(); // ???

            await this.logger.run("afterSync", async log => {
                await Promise.all(rooms.map((r) => {
                    return r.room.afterSync(r.changes, log);
                }));
            });
            // room.afterSyncCompleted E2EE key share requests

            // TODO: give valid args here
            this.session.applyRoomCollectionChangesAfterSync([], rooms.map((r) => {
                return {
                    id: r.room.id,
                    room: r.room,
                    shouldAdd: true, // TODO: only if new room and membership = join
                }
            }), []);
        });
    }

    // The purpose of this function is to process the response `ops` array by modifying the current
    // roooms list. It does this non-destructively to ensure that if we die half way through processing
    // we are left in a consistent state. It has a few responsibilities:
    //  - Keep the index->room_id map up-to-date, this is the sort order for the room list.
    //  - Remove rooms we are no longer tracking e.g they fell off the sliding window.
    //  - Add/update rooms which have new events.
    // This functions returns the new index->room_id map with updated values along with a bunch of
    // RoomUpdates which contain things like new timeline events, required state, etc. Note we don't
    // especially handle removed rooms as we don't want to nuke precious data: it's enough to just remove
    // them from the map for them to disappear from the list.
    private processOps(ops: Op[]): { indexToRoom: IndexToRoomId, updates: RoomResponse[] } {
        // copy the index->room_id map. This is assumed to be reasonably cheap as we expect to only have
        // up to 200 elements in this map. (first 100 then sliding window 100).
        let indexToRoomID = { ...this.roomIndexToRoomId };
        let roomUpdates: RoomResponse[] = []; // ordered by when we saw them in the response, earlier ops are earlier

        let gapIndex = -1;
        for (let i = 0; i < ops.length; i++) {
            const op = ops[i];
            switch (op.op) {
                case "SYNC": {
                    if (op.range === undefined || op.rooms === undefined) { // required fields
                        console.error("malformed SYNC:", op);
                        continue;
                    }
                    // e.g [100,199] (inclusive indexes) with an array of 100 rooms
                    const startIndex = op.range[0];
                    for (let j = startIndex; j <= op.range[1]; j++) {
                        const r = op.rooms[j - startIndex];
                        if (!r) {
                            break; // we are at the end of list
                        }
                        indexToRoomID[j] = r.room_id;
                        roomUpdates.push(r);
                    }
                    break;
                }
                case "INVALIDATE": {
                    if (op.range === undefined) { // required fields
                        console.error("malformed INVALIDATE:", op);
                        continue;
                    }
                    const startIndex = op.range[0];
                    for (let j = startIndex; j <= op.range[1]; j++) {
                        delete indexToRoomID[j];
                    }
                    break;
                }
                case "INSERT": {
                    if (op.index === undefined || op.room === undefined) { // required fields
                        console.error("malformed INSERT:", op);
                        continue;
                    }
                    if (indexToRoomID[op.index]) {
                        // there exists a room at this location so we need to shift items out of the way.
                        if (gapIndex < 0) {
                            console.error(`cannot INSERT as there is a room already at index ${op.index} there and no gap`);
                            continue;
                        }
                        //  0,1,2,3  index
                        // [A,B,C,D]
                        //   DEL 3
                        // [A,B,C,_]
                        //   INSERT E 0
                        // [E,A,B,C]
                        // gapIndex=3, op.index=0
                        if (gapIndex > op.index) {
                            // the gap is further down the list, shift every element to the right
                            // starting at the gap so we can just shift each element in turn:
                            // [A,B,C,_] gapIndex=3, op.index=0
                            // [A,B,C,C] i=3
                            // [A,B,B,C] i=2
                            // [A,A,B,C] i=1
                            // Terminate. We'll assign into op.index next.
                            for (let j = gapIndex; j > op.index; j--) {
                                if (indexInRange(this.ranges, j)) {
                                    indexToRoomID[j] = indexToRoomID[j - 1];
                                }
                            }
                        } else if (gapIndex < op.index) {
                            // the gap is further up the list, shift every element to the left
                            // starting at the gap so we can just shift each element in turn
                            for (let j = gapIndex; j < op.index; j++) {
                                if (indexInRange(this.ranges, j)) {
                                    indexToRoomID[j] = indexToRoomID[j + 1];
                                }
                            }
                        }
                    }
                    // assign to this index
                    indexToRoomID[op.index] = op.room.room_id;
                    roomUpdates.push(op.room);
                    break;
                }
                case "DELETE": {
                    if (op.index === undefined) { // required fields
                        console.error("malformed DELETE:", op);
                        continue;
                    }
                    // Delete the room at this index and remember the new gap. It may be filled in
                    // a moment by a corresponding INSERT.
                    delete indexToRoomID[op.index];
                    gapIndex = op.index;
                    break;
                }
                case "UPDATE": {
                    if (op.index === undefined || op.room === undefined) { // required fields
                        console.error("malformed UPDATE:", op);
                        continue;
                    }
                    roomUpdates.push(op.room);
                    break;
                }
                default:
                    console.error("skipping unknown op: ", op.op);
            }
        }

        return {
            indexToRoom: indexToRoomID,
            updates: roomUpdates,
        };
    }

    private openSyncTxn() {
        const storeNames = this.storage.storeNames;
        return this.storage.readWriteTxn([
            storeNames.session,
            storeNames.roomSummary,
            storeNames.archivedRoomSummary,
            storeNames.invites,
            storeNames.roomState,
            storeNames.roomMembers,
            storeNames.timelineEvents,
            storeNames.timelineRelations,
            storeNames.timelineFragments,
            storeNames.pendingEvents,
            storeNames.userIdentities,
            storeNames.groupSessionDecryptions,
            storeNames.deviceIdentities,
            // to discard outbound session when somebody leaves a room
            // and to create room key messages when somebody joins
            storeNames.outboundGroupSessions,
            storeNames.operations,
            storeNames.accountData,
            // to decrypt and store new room keys
            storeNames.olmSessions,
            storeNames.inboundGroupSessions,
        ]);
    }
}

const sleep = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

// SYNC 0 2 a b c; SYNC 6 8 d e f; DELETE 7; INSERT 0 e;
// 0 1 2 3 4 5 6 7 8
// a b c       d e f
// a b c       d _ f
// e a b c       d f  <--- c=3 is wrong as we are not tracking it, ergo we need to see if `i` is in range else drop it
const indexInRange = (ranges: number[][], i: number) => {
    let isInRange = false;
    ranges.forEach((r) => {
        if (r[0] <= i && i <= r[1]) {
            isInRange = true;
        }
    });
    return isInRange;
};

export function tests() {
    return {
        "processSyncOps": assert => {
            assert.equal(1, 1);
        },
    };
}