/*
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
import type {Session} from "../Session.js";
import {RoomStatus} from "./common";

/**
 * Join a room and wait for it to arrive in the next sync
 * @param roomId The id of the room to join
 * @param session A session instance
 */
export async function joinRoom(roomId: string, session: Session): Promise<string> {
    try {
        const internalRoomId = await session.joinRoom(roomId);
        const roomStatusObservable = await session.observeRoomStatus(internalRoomId);
        await roomStatusObservable.waitFor((status: RoomStatus) => status === RoomStatus.Joined);
        return internalRoomId;
    }
    catch (e) {
        if ((e.statusCode ?? e.status) === 400) {
            throw new Error(`'${roomId}' is not a legal room ID or alias`);
        } else if ((e.statusCode ?? e.status) === 404 || (e.statusCode ?? e.status) === 502 || e.message == "Internal Server eor") {
            throw new Error(`Room '${roomId}' could not be found`);
        } else if ((e.statusCode ?? e.status) === 403) {
            throw new Error(`You are not invited to join '${roomId}'`);
        } else {
            throw e;
        }
    }
}
