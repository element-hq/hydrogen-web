/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {ILogItem} from "../../../logging/types";
import type {StateEvent} from "../../storage/types";
import type {Transaction} from "../../storage/idb/Transaction";
import type {Room} from "../Room";
import type {MemberChange} from "../members/RoomMember";
import type {RoomStateHandler} from "./types";
import type {MemberSync} from "../timeline/persistence/MemberWriter.js";
import {BaseObservable} from "../../../observable/BaseObservable";

/** keeps track of all handlers registered with Session.observeRoomState */
export class RoomStateHandlerSet extends BaseObservable<RoomStateHandler> implements RoomStateHandler {
    async handleRoomState(room: Room, stateEvent: StateEvent, memberSync: MemberSync, txn: Transaction, log: ILogItem): Promise<void> {
        const promises: Promise<void>[] = [];
        for(let h of this._handlers) {
            promises.push(h.handleRoomState(room, stateEvent, memberSync, txn, log));
        }
        await Promise.all(promises);
    }
    updateRoomMembers(room: Room, memberChanges: Map<string, MemberChange>) {
        for(let h of this._handlers) {
            h.updateRoomMembers(room, memberChanges);
        }
    }
}
