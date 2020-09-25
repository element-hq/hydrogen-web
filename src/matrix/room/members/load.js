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

async function loadMembers({roomId, storage}) {
    const txn = storage.readTxn([
        storage.storeNames.roomMembers,
    ]);
    const memberDatas = await txn.roomMembers.getAll(roomId);
    return memberDatas.map(d => new RoomMember(d));
}

async function fetchMembers({summary, syncToken, roomId, hsApi, storage, setChangedMembersMap}) {
    // if any members are changed by sync while we're fetching members,
    // they will end up here, so we check not to override them
    const changedMembersDuringSync = new Map();
    setChangedMembersMap(changedMembersDuringSync);
    
    const memberResponse = await hsApi.members(roomId, {at: syncToken}).response();

    const txn = storage.readWriteTxn([
        storage.storeNames.roomSummary,
        storage.storeNames.roomMembers,
    ]);

    let summaryChanges;
    let members;
    
    try {
        summaryChanges = summary.writeHasFetchedMembers(true, txn);
        const {roomMembers} = txn;
        const memberEvents = memberResponse.chunk;
        if (!Array.isArray(memberEvents)) {
            throw new Error("malformed");
        }
        members = await Promise.all(memberEvents.map(async memberEvent => {
            const userId = memberEvent?.state_key;
            if (!userId) {
                throw new Error("malformed");
            }
            // this member was changed during a sync that happened while calling /members
            // and thus is more recent, so don't overwrite
            const changedMember = changedMembersDuringSync.get(userId);
            if (changedMember) {
                return changedMember;
            } else {
                const member = RoomMember.fromMemberEvent(roomId, memberEvent);
                if (member) {
                    roomMembers.set(member.serialize());
                }
                return member;
            }
        }));
    } catch (err) {
        // abort txn on any error
        txn.abort();
        throw err;
    } finally {
        // important this gets cleared
        // or otherwise Room remains in "fetching-members" mode
        setChangedMembersMap(null);
    }
    await txn.complete();
    summary.applyChanges(summaryChanges);
    return members;
}

export async function fetchOrLoadMembers(options) {
    const {summary} = options;
    if (!summary.data.hasFetchedMembers) {
        return fetchMembers(options);
    } else {
        return loadMembers(options);
    }
}
