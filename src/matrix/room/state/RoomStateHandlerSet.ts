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
