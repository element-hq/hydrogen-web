/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
