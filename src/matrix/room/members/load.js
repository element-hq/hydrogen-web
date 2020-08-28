/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {RoomMember} from "./RoomMember.js";

export async function loadMembers(roomId, txn) {
    const memberDatas = await txn.roomMembers.getAll(roomId);
    return memberDatas.map(d => new RoomMember(d));
}

export async function fetchMemberSnapshot({summary, roomId, hsApi, setChangedMembersMap}) {
    // if any members are changed by sync while we're fetching members,
    // they will end up here, so we check not to override them
    const changedMembersDuringSync = new Map();
    setChangedMembersMap(changedMembersDuringSync);
    
    const memberResponse = await hsApi.members(roomId, {at: summary.lastPaginationToken}).response();
    if (!Array.isArray(memberResponse?.chunk)) {
        throw new Error("malformed");
    }
    return new MemberSnapshot({memberEvents: memberResponse.chunk,
        setChangedMembersMap, changedMembersDuringSync, summary, roomId});
}

/** Container for fetching /members while handling race with /sync. Can be persisted as part of a wider transaction */
class MemberSnapshot {
    constructor({memberEvents, setChangedMembersMap, changedMembersDuringSync, summary, roomId}) {
        this._memberEvents = memberEvents;
        this._setChangedMembersMap = setChangedMembersMap;
        this._changedMembersDuringSync = changedMembersDuringSync;
        this._summary = summary;
        this._roomId = roomId;
        this._members = null;
    }

    write(txn) {
        let summaryChanges;        
        // this needs to happen after the txn is opened to prevent a race
        // between awaiting the opening of the txn and the sync
        this._members = this._memberEvents.map(memberEvent => {
            const userId = memberEvent?.state_key;
            if (!userId) {
                throw new Error("malformed");
            }
            // this member was changed during a sync that happened while calling /members
            // and thus is more recent, so don't overwrite
            const changedMember = this._changedMembersDuringSync.get(userId);
            if (changedMember) {
                return changedMember;
            } else {
                return RoomMember.fromMemberEvent(this._roomId, memberEvent);
            }
        });
        // store members
        const {roomMembers} = txn;
        for (const member of this._members) {
            if (member) {
                roomMembers.set(member.serialize());
            }
        }
        // store flag
        summaryChanges = this._summary.writeHasFetchedMembers(true, txn);
        return summaryChanges;
    }

    applyWrite(summaryChanges) {
        this._summary.applyChanges(summaryChanges);
    }

    get members() {
        if (!this._members) {
            throw new Error("call write first");
        }
        return this._members;
    }

    dispose() {
        // important this gets cleared
        // or otherwise Room remains in "fetching-members" mode
        this._setChangedMembersMap(null);
    }
}
