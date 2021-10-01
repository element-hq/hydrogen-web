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
import {Store} from "../Store";
import {MemberData} from "./RoomMemberStore";

// TODO: Move to Invite when that's TypeScript.
export interface InviteData {
    roomId: string;
    isEncrypted: boolean;
    isDirectMessage: boolean;
    name?: string;
    avatarUrl?: string;
    avatarColorId: number;
    canonicalAlias?: string;
    timestamp: number;
    joinRule: string;
    inviter?: MemberData;
}

export class InviteStore {
    private _inviteStore: Store<InviteData>;

    constructor(inviteStore: Store<InviteData>) {
        this._inviteStore = inviteStore;
    }

    getAll(): Promise<InviteData[]> {
        return this._inviteStore.selectAll();
    }

    set(invite: InviteData): void {
        this._inviteStore.put(invite);
    }

    remove(roomId: string): void {
        this._inviteStore.delete(roomId);
    }
}
