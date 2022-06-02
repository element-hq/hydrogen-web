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
