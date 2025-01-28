/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {Room} from "../Room";
import type {StateEvent} from "../../storage/types";
import type {Transaction} from "../../storage/idb/Transaction";
import type {ILogItem} from "../../../logging/types";
import type {MemberChange} from "../members/RoomMember";
import type {MemberSync} from "../timeline/persistence/MemberWriter";

/** used for Session.observeRoomState, which observes in all room, but without loading from storage
 * It receives the sync write transaction, so other stores can be updated as part of the same transaction. */
export interface RoomStateHandler {
    handleRoomState(room: Room, stateEvent: StateEvent, memberSync: MemberSync, syncWriteTxn: Transaction, log: ILogItem): Promise<void>;
    updateRoomMembers(room: Room, memberChanges: Map<string, MemberChange>): void;
}

/**
 * used for Room.observeStateType and Room.observeStateTypeAndKey
 * @internal
 * */
export interface StateObserver {
    handleStateEvent(event: StateEvent);
    load(roomId: string, txn: Transaction): Promise<void>;
    setRemoveCallback(callback: () => void);
}
