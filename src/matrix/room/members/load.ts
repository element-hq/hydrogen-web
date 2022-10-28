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

import {RoomMember} from "./RoomMember";
import type {ILogger, ILogItem} from "../../../logging/types";
import type {Transaction} from "../../storage/idb/Transaction";
import type {RoomSummary} from "../RoomSummary";
import type {HomeServerApi} from "../../net/HomeServerApi";
import type {SummaryData} from "../RoomSummary";
import {MemberStateEvent} from "../../net/types/roomEvents";


async function loadMembers({roomId, storage, txn}: LoadMembersOptions): Promise<RoomMember[]> {
    if (!txn) {
        txn = await storage.readTxn([
            storage.storeNames.roomMembers,
        ]);
    }
    const memberDatas = await txn.roomMembers.getAll(roomId);
    return memberDatas.map(d => new RoomMember(d));
}

async function fetchMembers(
    {
        summary,
        syncToken,
        roomId,
        hsApi,
        storage,
        setChangedMembersMap,
    }: FetchMembersOptions,
    log: ILogItem
): Promise<(RoomMember | undefined)[]> {
    // if any members are changed by sync while we're fetching members,
    // they will end up here, so we check not to override them
    const changedMembersDuringSync = new Map<string, RoomMember>();
    setChangedMembersMap(changedMembersDuringSync);

    const memberResponse = await hsApi.members(roomId, {at: syncToken}, {log}).response();

    const txn = await storage.readWriteTxn([
        storage.storeNames.roomSummary,
        storage.storeNames.roomMembers,
    ]);

    let summaryChanges: SummaryData;
    let members: (RoomMember | undefined)[] = [];

    try {
        summaryChanges = summary.writeHasFetchedMembers(true, txn);
        const {roomMembers} = txn;
        const memberEvents: MemberStateEvent[] = memberResponse.chunk;
        if (!Array.isArray(memberEvents)) {
            throw new Error("malformed");
        }
        log.set("members", memberEvents.length);
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

export async function fetchOrLoadMembers(options: FetchOrLoadMembersOptions, logger: ILogger): Promise<(RoomMember | undefined)[]> {
    const {summary} = options;
    if (!summary.data.hasFetchedMembers) {
        // we only want to log if we fetch members, so start or continue the optional log operation here
        return logger.wrapOrRun(options.log, "fetchMembers", log => fetchMembers(options, log));
    } else {
        return loadMembers(options);
    }
}

export async function fetchOrLoadMember(
    options: FetchOrLoadMemberOptions,
    logger: ILogger
): Promise<RoomMember | undefined> {
    const member = await loadMember(options);
    const {summary} = options;
    if (!summary.data.hasFetchedMembers && !member) {
        // We haven't fetched the memberlist yet; so ping the hs to see if this member does exist
        return logger.wrapOrRun(options.log, "fetchMember", log => fetchMember(options, log));
    }
    return member;
}

async function loadMember({roomId, userId, storage}: LoadMemberOptions): Promise<RoomMember | undefined> {
    const txn = await storage.readTxn([storage.storeNames.roomMembers,]);
    const member = await txn.roomMembers.get(roomId, userId);
    return member? new RoomMember(member) : undefined;
}

async function fetchMember({roomId, userId, hsApi, storage}: FetchMemberOptions, log: ILogItem): Promise<(RoomMember | undefined)> {
    let memberData;
    try {
        memberData = await hsApi.state(roomId, "m.room.member", userId, { log }).response();
    }
    catch (error) {
        if (error.name === "HomeServerError" && error.errcode === "M_NOT_FOUND") {
            return undefined;
        }
        throw error;
    }
    const member = new RoomMember({
        roomId,
        userId,
        membership: memberData.membership,
        avatarUrl: memberData.avatar_url,
        displayName: memberData.displayname,
    });
    const txn = await storage.readWriteTxn([storage.storeNames.roomMembers]);
    try {
        txn.roomMembers.set(member.serialize());
    }
    catch(e) {
        txn.abort();
        throw e;
    }
    await txn.complete();
    return member;
}

type FetchMembersOptions = {
    hsApi: HomeServerApi;
    log: ILogItem;
    setChangedMembersMap: (map: Map<string, RoomMember> | null) => void;
    summary: RoomSummary;
    syncToken: string;
    roomId: string;
    storage: Storage;
}

type LoadMembersOptions = {
    roomId: string;
    storage: Storage;
    txn: Transaction;
}

type FetchOrLoadMembersOptions = FetchMembersOptions & LoadMembersOptions;

type FetchMemberOptions = {
    hsApi: HomeServerApi;
    roomId: string;
    userId: string;
    storage: Storage;
}

type LoadMemberOptions = {
    roomId: string;
    userId: string;
    storage: Storage;
}

type FetchOrLoadMemberOptions = {
    summary: RoomSummary;
    log: ILogItem;
} & FetchMemberOptions &
    LoadMemberOptions;

