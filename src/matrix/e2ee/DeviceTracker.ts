/*
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

import {verifyEd25519Signature, getEd25519Signature, SIGNATURE_ALGORITHM, SignatureVerification} from "./common";
import {HistoryVisibility, shouldShareKey, DeviceKey, getDeviceEd25519Key, getDeviceCurve25519Key} from "./common";
import {RoomMember} from "../room/members/RoomMember.js";
import {getKeyUsage, getKeyEd25519Key, getKeyUserId, KeyUsage} from "../verification/CrossSigning";
import {MemberChange} from "../room/members/RoomMember";
import type {CrossSigningKey} from "../verification/CrossSigning";
import type {HomeServerApi} from "../net/HomeServerApi";
import type {ObservableMap} from "../../observable/map";
import type {Room} from "../room/Room";
import type {ILogItem} from "../../logging/types";
import type {Storage} from "../storage/idb/Storage";
import type {Transaction} from "../storage/idb/Transaction";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

// tracking status for cross-signing and device keys
export enum KeysTrackingStatus {
    Outdated = 0,
    UpToDate = 1
}

export type UserIdentity = {
    userId: string,
    roomIds: string[],
    keysTrackingStatus: KeysTrackingStatus,
}

function createUserIdentity(userId: string, initialRoomId?: string): UserIdentity {
    return {
        userId: userId,
        roomIds: initialRoomId ? [initialRoomId] : [],
        keysTrackingStatus: KeysTrackingStatus.Outdated,
    };
}

function addRoomToIdentity(identity: UserIdentity | undefined, userId: string, roomId: string): UserIdentity | undefined {
    if (!identity) {
        identity = createUserIdentity(userId, roomId);
        return identity;
    } else {
        if (!identity.roomIds.includes(roomId)) {
            identity.roomIds.push(roomId);
            return identity;
        }
    }
}

export class DeviceTracker {
    private readonly _storage: Storage;
    private readonly _getSyncToken: () => string;
    private readonly _olmUtil: Olm.Utility;
    private readonly _ownUserId: string;
    private readonly _ownDeviceId: string;

    constructor(options: {storage: Storage, getSyncToken: () => string, olmUtil: Olm.Utility, ownUserId: string, ownDeviceId: string}) {
        this._storage = options.storage;
        this._getSyncToken = options.getSyncToken;
        this._olmUtil = options.olmUtil;
        this._ownUserId = options.ownUserId;
        this._ownDeviceId = options.ownDeviceId;
    }

    async writeDeviceChanges(changedUserIds: ReadonlyArray<string>, txn: Transaction, log: ILogItem): Promise<void> {
        const {userIdentities} = txn;
        // TODO: should we also look at left here to handle this?:
        // the usual problem here is that you share a room with a user,
        // go offline, the remote user leaves the room, changes their devices,
        // then rejoins the room you share (or another room).
        // At which point you come online, all of this happens in the gap, 
        // and you don't notice that they ever left, 
        // and so the client doesn't invalidate their device cache for the user
        log.set("changed", changedUserIds.length);
        await Promise.all(changedUserIds.map(async userId => {
            const user = await userIdentities.get(userId);
            if (user) {
                log.log({l: "outdated", id: userId});
                user.keysTrackingStatus = KeysTrackingStatus.Outdated;
                userIdentities.set(user);
            }
        }));
    }

    /** @return Promise<{added: string[], removed: string[]}> the user ids for who the room was added or removed to the userIdentity,
     *                                                        and with who a key should be now be shared
     **/
    async writeMemberChanges(room: Room, memberChanges: Map<string, MemberChange>, historyVisibility: HistoryVisibility, txn: Transaction): Promise<{added: string[], removed: string[]}> {
        const added: string[] = [];
        const removed: string[] = [];
        await Promise.all(Array.from(memberChanges.values()).map(async memberChange => {
            // keys should now be shared with this member?
            // add the room to the userIdentity if so
            if (shouldShareKey(memberChange.membership, historyVisibility)) {
                if (await this._addRoomToUserIdentity(memberChange.roomId, memberChange.userId, txn)) {
                    added.push(memberChange.userId);
                }
            } else if (shouldShareKey(memberChange.previousMembership, historyVisibility)) {
                // try to remove room we were previously sharing the key with the member but not anymore
                const {roomId} = memberChange;
                // if we left the room, remove room from all user identities in the room
                if (memberChange.userId === this._ownUserId) {
                    const userIds = await txn.roomMembers.getAllUserIds(roomId);
                    await Promise.all(userIds.map(userId => {
                        return this._removeRoomFromUserIdentity(roomId, userId, txn);
                    }));
                } else {
                    await this._removeRoomFromUserIdentity(roomId, memberChange.userId, txn);
                }
                removed.push(memberChange.userId);
            }
        }));
        return {added, removed};
    }

    async trackRoom(room: Room, historyVisibility: HistoryVisibility, log: ILogItem): Promise<void> {
        if (room.isTrackingMembers || !room.isEncrypted) {
            return;
        }
        const memberList = await room.loadMemberList(undefined, log);
        const txn = await this._storage.readWriteTxn([
            this._storage.storeNames.roomSummary,
            this._storage.storeNames.userIdentities,
            this._storage.storeNames.deviceKeys, // to remove all devices in _removeRoomFromUserIdentity
        ]);
        try {
            let isTrackingChanges;
            try {
                isTrackingChanges = room.writeIsTrackingMembers(true, txn);
                const members = Array.from((memberList.members as ObservableMap<string, RoomMember>).values());
                log.set("members", members.length);
                // TODO: should we remove any userIdentities we should not share the key with??
                // e.g. as an extra security measure if we had a mistake in other code?
                await Promise.all(members.map(async member => {
                    if (shouldShareKey(member.membership, historyVisibility)) {
                        await this._addRoomToUserIdentity(member.roomId, member.userId, txn);
                    } else {
                        await this._removeRoomFromUserIdentity(member.roomId, member.userId, txn);
                    }
                }));
            } catch (err) {
                txn.abort();
                throw err;
            }
            await txn.complete();
            room.applyIsTrackingMembersChanges(isTrackingChanges);
        } finally {
            memberList.release();
        }
    }

    async invalidateUserKeys(userId: string): Promise<void> {
        const txn = await this._storage.readWriteTxn([this._storage.storeNames.userIdentities]);
        const userIdentity = await txn.userIdentities.get(userId);
        if (userIdentity) {
            userIdentity.keysTrackingStatus = KeysTrackingStatus.Outdated;
            txn.userIdentities.set(userIdentity);
        }
        await txn.complete();
    }

    async getCrossSigningKeyForUser(userId: string, usage: KeyUsage, hsApi: HomeServerApi | undefined, log: ILogItem): Promise<CrossSigningKey | undefined> {
        return await log.wrap({l: "DeviceTracker.getCrossSigningKeyForUser", id: userId, usage}, async log => {
            const txn = await this._storage.readTxn([
                this._storage.storeNames.userIdentities,
                this._storage.storeNames.crossSigningKeys,
            ]);
            const userIdentity = await txn.userIdentities.get(userId);
            if (userIdentity && userIdentity.keysTrackingStatus !== KeysTrackingStatus.Outdated) {
                return await txn.crossSigningKeys.get(userId, usage);
            }
            // not allowed to access the network, bail out
            if (!hsApi) {
                return undefined;
            }
            // fetch from hs
            const keys = await this._queryKeys([userId], hsApi, log);
            switch (usage) {
                case KeyUsage.Master:
                    return keys.masterKeys.get(userId);
                case KeyUsage.SelfSigning:
                    return keys.selfSigningKeys.get(userId);
                case KeyUsage.UserSigning:
                    return keys.userSigningKeys.get(userId);
            }
        });
    }

    async writeHistoryVisibility(room: Room, historyVisibility: HistoryVisibility, syncTxn: Transaction, log: ILogItem): Promise<{added: string[], removed: string[]}> {
        const added: string[] = [];
        const removed: string[] = [];
        if (room.isTrackingMembers && room.isEncrypted) {
            await log.wrap("rewriting userIdentities", async log => {
                // TODO: how do we know that we won't fetch the members from the server here and hence close the syncTxn?
                const memberList = await room.loadMemberList(syncTxn, log);
                try {
                    const members = Array.from((memberList.members as ObservableMap<string, RoomMember>).values());
                    log.set("members", members.length);
                    await Promise.all(members.map(async member => {
                        if (shouldShareKey(member.membership, historyVisibility)) {
                            if (await this._addRoomToUserIdentity(member.roomId, member.userId, syncTxn)) {
                                added.push(member.userId);
                            }
                        } else {
                            if (await this._removeRoomFromUserIdentity(member.roomId, member.userId, syncTxn)) {
                                removed.push(member.userId);
                            }
                        }
                    }));
                } finally {
                    memberList.release();
                }
            });
        }
        return {added, removed};
    }

    async _addRoomToUserIdentity(roomId: string, userId: string, txn: Transaction): Promise<boolean> {
        const {userIdentities} = txn;
        const identity = await userIdentities.get(userId);
        const updatedIdentity = addRoomToIdentity(identity, userId, roomId);
        if (updatedIdentity) {
            userIdentities.set(updatedIdentity);
            return true;
        }
        return false;
    }

    async _removeRoomFromUserIdentity(roomId: string, userId: string, txn: Transaction): Promise<boolean> {
        const {userIdentities, deviceKeys} = txn;
        const identity = await userIdentities.get(userId);
        if (identity) {
            identity.roomIds = identity.roomIds.filter(id => id !== roomId);
            // no more encrypted rooms with this user, remove
            if (identity.roomIds.length === 0) {
                userIdentities.remove(userId);
                deviceKeys.removeAllForUser(userId);
            } else {
                userIdentities.set(identity);
            }
            return true;
        }
        return false;
    }

    async _queryKeys(userIds: string[], hsApi: HomeServerApi, log: ILogItem): Promise<{
        deviceKeys: Map<string, DeviceKey[]>,
        masterKeys: Map<string, CrossSigningKey>,
        selfSigningKeys: Map<string, CrossSigningKey>,
        userSigningKeys: Map<string, CrossSigningKey>
    }> {
        // TODO: we need to handle the race here between /sync and /keys/query just like we need to do for the member list ...
        // there are multiple requests going out for /keys/query though and only one for /members
        // So, while doing /keys/query, writeDeviceChanges should add userIds marked as outdated to a list
        // when /keys/query returns, we should check that list and requery if we queried for a given user.
        // and then remove the list.

        const deviceKeyResponse = await hsApi.queryKeys({
            "timeout": 10000,
            "device_keys": userIds.reduce((deviceKeysMap, userId) => {
                deviceKeysMap[userId] = [];
                return deviceKeysMap;
            }, {}),
            "token": this._getSyncToken()
        }, {log}).response();

        const masterKeys = log.wrap("master keys", log => this._filterVerifiedCrossSigningKeys(deviceKeyResponse["master_keys"], KeyUsage.Master, log));
        const selfSigningKeys = log.wrap("self-signing keys", log => this._filterVerifiedCrossSigningKeys(deviceKeyResponse["self_signing_keys"], KeyUsage.SelfSigning, log));
        const userSigningKeys = log.wrap("user-signing keys", log => this._filterVerifiedCrossSigningKeys(deviceKeyResponse["user_signing_keys"], KeyUsage.UserSigning, log));
        const deviceKeys = log.wrap("device keys", log => this._filterVerifiedDeviceKeys(deviceKeyResponse["device_keys"], log));
        const txn = await this._storage.readWriteTxn([
            this._storage.storeNames.userIdentities,
            this._storage.storeNames.deviceKeys,
            this._storage.storeNames.crossSigningKeys,
        ]);
        let deviceIdentities;
        try {
            for (const key of masterKeys.values()) {
                txn.crossSigningKeys.set(key);
            }
            for (const key of selfSigningKeys.values()) {
                txn.crossSigningKeys.set(key);
            }
            for (const key of userSigningKeys.values()) {
                txn.crossSigningKeys.set(key);
            }
            let totalCount = 0;
            await Promise.all(Array.from(deviceKeys.keys()).map(async (userId) => {
                let deviceKeysForUser = deviceKeys.get(userId)!;
                totalCount += deviceKeysForUser.length;
                // check for devices that changed their keys and keep the old key
                deviceKeysForUser = await this._storeQueriedDevicesForUserId(userId, deviceKeysForUser, txn);
                deviceKeys.set(userId, deviceKeysForUser);
            }));
            log.set("devices", totalCount);
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
        return {
            deviceKeys,
            masterKeys,
            selfSigningKeys,
            userSigningKeys
        };
    }

    async _storeQueriedDevicesForUserId(userId: string, deviceKeys: DeviceKey[], txn: Transaction): Promise<DeviceKey[]> {
        // TODO: we should obsolete (flag) the device keys that have been removed,
        // but keep them to verify messages encrypted with it?
        const knownDeviceIds = await txn.deviceKeys.getAllDeviceIds(userId);
        // delete any devices that we know off but are not in the response anymore.
        // important this happens before checking if the ed25519 key changed,
        // otherwise we would end up deleting existing devices with changed keys.
        for (const deviceId of knownDeviceIds) {
            if (deviceKeys.every(di => di.device_id !== deviceId)) {
                txn.deviceKeys.remove(userId, deviceId);
            }
        }

        // all the device identities as we will have them in storage
        const allDeviceKeys: DeviceKey[] = [];
        const deviceKeysToStore: DeviceKey[] = [];
        // filter out devices that have changed their ed25519 key since last time we queried them
        await Promise.all(deviceKeys.map(async deviceKey => {
            if (knownDeviceIds.includes(deviceKey.device_id)) {
                const existingDevice = await txn.deviceKeys.get(deviceKey.user_id, deviceKey.device_id);
                if (existingDevice && getDeviceEd25519Key(existingDevice) !== getDeviceEd25519Key(deviceKey)) {
                    allDeviceKeys.push(existingDevice);
                    return;
                }
            }
            allDeviceKeys.push(deviceKey);
            deviceKeysToStore.push(deviceKey);
        }));
        // store devices
        for (const deviceKey of deviceKeysToStore) {
            txn.deviceKeys.set(deviceKey);
        }
        // mark user identities as up to date
        let identity = await txn.userIdentities.get(userId);
        if (!identity) {
            // create the identity if it doesn't exist, which can happen if
            // we request devices before tracking the room.
            // IMPORTANT here that the identity gets created without any roomId!
            // if we claim that we share and e2ee room with the user without having
            // checked, we could share keys with that user without them being in the room
            identity = createUserIdentity(userId);
        }
        identity.keysTrackingStatus = KeysTrackingStatus.UpToDate;
        txn.userIdentities.set(identity);

        return allDeviceKeys;
    }

    _filterVerifiedCrossSigningKeys(crossSigningKeysResponse: {[userId: string]: CrossSigningKey}, usage: KeyUsage, log: ILogItem): Map<string, CrossSigningKey> {
        const keys: Map<string, CrossSigningKey> = new Map();
        if (!crossSigningKeysResponse) {
            return keys;
        }
        for (const [userId, keyInfo] of Object.entries(crossSigningKeysResponse)) {
            log.wrap({l: userId}, log => {
                if (this._validateCrossSigningKey(userId, keyInfo, usage, log)) {
                    keys.set(getKeyUserId(keyInfo)!, keyInfo);
                }
            });
        }
        return keys;
    }

    _validateCrossSigningKey(userId: string, keyInfo: CrossSigningKey, usage: KeyUsage, log: ILogItem): boolean {
        if (getKeyUserId(keyInfo) !== userId) {
            log.log({l: "user_id mismatch", userId: keyInfo["user_id"]});
            return false;
        }
        if (getKeyUsage(keyInfo) !== usage) {
            log.log({l: "usage mismatch", usage: keyInfo.usage});
            return false;
        }
        const publicKey = getKeyEd25519Key(keyInfo);
        if (!publicKey) {
            log.log({l: "no ed25519 key", keys: keyInfo.keys});
            return false;
        }
        return true;
    }

    /**
     * @return {Array<{userId, verifiedKeys: Array<DeviceSection>>}
     */
    _filterVerifiedDeviceKeys(
        keyQueryDeviceKeysResponse: {[userId: string]: {[deviceId: string]: DeviceKey}},
        parentLog: ILogItem
    ): Map<string, DeviceKey[]> {
        const curve25519Keys: Set<string> = new Set();
        const keys: Map<string, DeviceKey[]> = new Map();
        if (!keyQueryDeviceKeysResponse) {
            return keys;
        }
        for (const [userId, keysByDevice] of Object.entries(keyQueryDeviceKeysResponse)) {
            parentLog.wrap(userId, log => {
                const verifiedEntries = Object.entries(keysByDevice).filter(([deviceId, deviceKey]) => {
                    return log.wrap(deviceId, log => {
                        if (this._validateDeviceKey(userId, deviceId, deviceKey, log)) {
                            const curve25519Key = getDeviceCurve25519Key(deviceKey);
                            if (curve25519Keys.has(curve25519Key)) {
                                parentLog.log({
                                    l: "ignore device with duplicate curve25519 key",
                                    keys: deviceKey
                                }, parentLog.level.Warn);
                                return false;
                            }
                            curve25519Keys.add(curve25519Key);
                            return true;
                        } else {
                            return false;
                        }
                    });
                });
                const verifiedKeys = verifiedEntries.map(([, deviceKeys]) => deviceKeys);
                keys.set(userId, verifiedKeys);
            });
        }
        return keys;
    }

    _validateDeviceKey(userIdFromServer: string, deviceIdFromServer: string, deviceKey: DeviceKey, log: ILogItem): boolean {
        const deviceId = deviceKey["device_id"];
        const userId = deviceKey["user_id"];
        if (userId !== userIdFromServer) {
            log.log("user_id mismatch");
            return false;
        }
        if (deviceId !== deviceIdFromServer) {
            log.log("device_id mismatch");
            return false;
        }
        const ed25519Key = getDeviceEd25519Key(deviceKey);
        const curve25519Key = getDeviceCurve25519Key(deviceKey);
        if (typeof ed25519Key !== "string" || typeof curve25519Key !== "string") {
            log.log("ed25519 and/or curve25519 key invalid").set({deviceKey});
            return false;
        }
        const isValid = verifyEd25519Signature(this._olmUtil, userId, deviceId, ed25519Key, deviceKey, log) === SignatureVerification.Valid;
        if (!isValid) {
            log.log({
                l: "ignore device with invalid signature",
                keys: deviceKey
            }, log.level.Warn);
        }
        return isValid;
    }

    /**
     * Gives all the device identities for a room that is already tracked.
     * Can be used to decide which users to share keys with.
     * Assumes room is already tracked. Call `trackRoom` first if unsure.
     * @param  {String} roomId [description]
     * @return {[type]}        [description]
     */
    async devicesForTrackedRoom(roomId: string, hsApi: HomeServerApi, log: ILogItem): Promise<DeviceKey[]> {
        const txn = await this._storage.readTxn([
            this._storage.storeNames.roomMembers,
            this._storage.storeNames.userIdentities,
        ]);

        // because we don't have multiEntry support in IE11, we get a set of userIds that is pretty close to what we
        // need as a good first filter (given that non-join memberships will be in there). After fetching the identities,
        // we check which ones have the roomId for the room we're looking at.
        
        // So, this will also contain non-joined memberships
        const userIds = await txn.roomMembers.getAllUserIds(roomId);
        // TODO: check here if userIds is safe? yes it is
        return await this._devicesForUserIdsInTrackedRoom(roomId, userIds, txn, hsApi, log);
    }

    /** 
     * Can be used to decide which users to share keys with.
     * Assumes room is already tracked. Call `trackRoom` first if unsure.
     * This will not return the device key for our own user, as we don't need to share keys with ourselves.
     */
    async devicesForRoomMembers(roomId: string, userIds: string[], hsApi: HomeServerApi, log: ILogItem): Promise<DeviceKey[]> {
        const txn = await this._storage.readTxn([
            this._storage.storeNames.userIdentities,
        ]);
        return await this._devicesForUserIdsInTrackedRoom(roomId, userIds, txn, hsApi, log);
    }

    /** 
     * Cannot be used to decide which users to share keys with.
     * Does not assume membership to any room or whether any room is tracked.
     * This will return device keys for our own user, including our own device.
     */
    async devicesForUsers(userIds: string[], hsApi: HomeServerApi, log: ILogItem): Promise<DeviceKey[]> {
        const txn = await this._storage.readTxn([
            this._storage.storeNames.userIdentities,
        ]);

        const upToDateIdentities: UserIdentity[] = [];
        const outdatedUserIds: string[] = [];
        await Promise.all(userIds.map(async userId => {
            const i = await txn.userIdentities.get(userId);
            if (i && i.keysTrackingStatus === KeysTrackingStatus.UpToDate) {
                upToDateIdentities.push(i);
            } else if (!i || i.keysTrackingStatus === KeysTrackingStatus.Outdated) {
                // allow fetching for userIdentities we don't know about yet,
                // as we don't assume the room is tracked here.
                outdatedUserIds.push(userId);
            }
        }));
        return this._devicesForUserIdentities(upToDateIdentities, outdatedUserIds, hsApi, log);
    }

    /** Gets a single device */
    async deviceForId(userId: string, deviceId: string, hsApi: HomeServerApi, log: ILogItem): Promise<DeviceKey | undefined> {
        /**
         * 1. If the device keys are outdated, we will fetch all the keys and update them.
         */
        const userIdentityTxn = await this._storage.readTxn([this._storage.storeNames.userIdentities]);
        const userIdentity = await userIdentityTxn.userIdentities.get(userId);
        if (userIdentity?.keysTrackingStatus !== KeysTrackingStatus.UpToDate) {
            const {deviceKeys} = await this._queryKeys([userId], hsApi, log);
            const keyList = deviceKeys.get(userId);
            const device = keyList!.find(device => device.device_id === deviceId);
            return device;
        }

        /**
         * 2. If keys are up to date, return from storage.
         */
        const txn = await this._storage.readTxn([
            this._storage.storeNames.deviceKeys,
        ]);
        let deviceKey = await txn.deviceKeys.get(userId, deviceId);
        if (deviceKey) {
            log.set("existingDevice", true);
        } else {
            //// BEGIN EXTRACT (deviceKeysMap)
            const deviceKeyResponse = await hsApi.queryKeys({
                "timeout": 10000,
                "device_keys": {
                    [userId]: [deviceId]
                },
                "token": this._getSyncToken()
            }, {log}).response();
            // verify signature
            const verifiedKeysPerUser = log.wrap("verify", log => this._filterVerifiedDeviceKeys(deviceKeyResponse["device_keys"], log));
            //// END EXTRACT
            const verifiedKey = verifiedKeysPerUser.get(userId)?.find(d => d.device_id === deviceId);
            // user hasn't uploaded keys for device?
            if (!verifiedKey) {
                return undefined;
            }
            const txn = await this._storage.readWriteTxn([
                this._storage.storeNames.deviceKeys,
            ]);
            // todo: the following comment states what the code does
            // but it fails to explain why it does what it does...

            // check again we don't have the device already.
            // when updating all keys for a user we allow updating the
            // device when the key hasn't changed so the device display name
            // can be updated, but here we don't.
            const existingDevice = await txn.deviceKeys.get(userId, deviceId);
            if (existingDevice) {
                deviceKey = existingDevice;
                log.set("existingDeviceAfterFetch", true);
            } else {
                try {
                    txn.deviceKeys.set(verifiedKey);
                    deviceKey = verifiedKey;
                    log.set("newDevice", true);
                } catch (err) {
                    txn.abort();
                    throw err;
                }
                await txn.complete();
            }
        }
        return deviceKey;
    }

    async deviceForCurveKey(userId: string, key: string, hsApi: HomeServerApi, log: ILogItem): Promise<DeviceKey | undefined> {
        const txn = await this._storage.readTxn([
            this._storage.storeNames.deviceKeys,
            this._storage.storeNames.userIdentities,
        ]);
        const userIdentity = await txn.userIdentities.get(userId);
        if (userIdentity?.keysTrackingStatus !== KeysTrackingStatus.UpToDate) {
            const {deviceKeys} = await this._queryKeys([userId], hsApi, log);
            const keyList = deviceKeys.get(userId);
            const device = keyList!.find(device => getDeviceCurve25519Key(device) === key);
            return device;
        }
        const device = await txn.deviceKeys.getByCurve25519Key(key);
        return device;
    }

    /**
     * Gets all the device identities with which keys should be shared for a set of users in a tracked room.
     * If any userIdentities are outdated, it will fetch them from the homeserver.
     * @param  {string} roomId the id of the tracked room to filter users by.
     * @param  {Array<string>} userIds a set of user ids to try and find the identity for.
     * @param  {Transaction} userIdentityTxn to read the user identities
     * @param  {HomeServerApi} hsApi
     * @return {Array<DeviceKey>} all devices identities for the given users we should share keys with.
     */
    async _devicesForUserIdsInTrackedRoom(roomId: string, userIds: string[], userIdentityTxn: Transaction, hsApi: HomeServerApi, log: ILogItem): Promise<DeviceKey[]> {
        const allMemberIdentities = await Promise.all(userIds.map(userId => userIdentityTxn.userIdentities.get(userId)));
        const identities = allMemberIdentities.filter(identity => {
            // we use roomIds to decide with whom we should share keys for a given room,
            // taking into account the membership and room history visibility.
            // so filter out anyone who we shouldn't share keys with.
            // Given we assume the room is tracked,
            // also exclude any userId which doesn't have a userIdentity yet.
            return identity && identity.roomIds.includes(roomId);
        }) as UserIdentity[]; // undefined has been filter out
        const upToDateIdentities = identities.filter(i => i.keysTrackingStatus === KeysTrackingStatus.UpToDate);
        const outdatedUserIds = identities
            .filter(i => i.keysTrackingStatus === KeysTrackingStatus.Outdated)
            .map(i => i.userId);
        let devices = await this._devicesForUserIdentities(upToDateIdentities, outdatedUserIds, hsApi, log);
        // filter out our own device as we should never share keys with it.
        devices = devices.filter(device => {
            const isOwnDevice = device.user_id === this._ownUserId && device.device_id === this._ownDeviceId;
            return !isOwnDevice;
        });
        return devices;
    }

    /** Gets the device identites for a set of user identities that
     * are known to be up to date, and a set of userIds that are known
     * to be absent from our store or are outdated. The outdated user ids
     * will have their keys fetched from the homeserver. */
    async _devicesForUserIdentities(upToDateIdentities: UserIdentity[], outdatedUserIds: string[], hsApi: HomeServerApi, log: ILogItem): Promise<DeviceKey[]> {
        log.set("uptodate", upToDateIdentities.length);
        log.set("outdated", outdatedUserIds.length);
        let queriedDeviceKeys: Map<string, DeviceKey[]> | undefined;
        if (outdatedUserIds.length) {
            // TODO: ignore the race between /sync and /keys/query for now,
            // where users could get marked as outdated or added/removed from the room while
            // querying keys
            const {deviceKeys} = await this._queryKeys(outdatedUserIds, hsApi, log);
            queriedDeviceKeys = deviceKeys;
        }

        const deviceTxn = await this._storage.readTxn([
            this._storage.storeNames.deviceKeys,
        ]);
        const devicesPerUser = await Promise.all(upToDateIdentities.map(identity => {
            return deviceTxn.deviceKeys.getAllForUserId(identity.userId);
        }));
        let flattenedDevices = devicesPerUser.reduce((all, devicesForUser) => all.concat(devicesForUser), []);
        if (queriedDeviceKeys && queriedDeviceKeys.size) {
            for (const deviceKeysForUser of queriedDeviceKeys.values()) {
                flattenedDevices = flattenedDevices.concat(deviceKeysForUser);
            }
        }
        return flattenedDevices;
    }

    async getDeviceByCurve25519Key(curve25519Key, txn: Transaction): Promise<DeviceKey | undefined> {
        return await txn.deviceKeys.getByCurve25519Key(curve25519Key);
    }

    get ownDeviceId(): string {
        return this._ownDeviceId;
    }
}

import {createMockStorage} from "../../mocks/Storage";
import {Instance as NullLoggerInstance} from "../../logging/NullLogger";

export function tests() {

    function createUntrackedRoomMock(roomId: string, joinedUserIds: string[], invitedUserIds: string[] = []) {
        return {
            id: roomId,
            isTrackingMembers: false,
            isEncrypted: true,
            loadMemberList: () => {
                const joinedMembers = joinedUserIds.map(userId => {return RoomMember.fromUserId(roomId, userId, "join");});
                const invitedMembers = invitedUserIds.map(userId => {return RoomMember.fromUserId(roomId, userId, "invite");});
                const members = joinedMembers.concat(invitedMembers);
                const memberMap = members.reduce((map, member) => {
                    map.set(member.userId, member);
                    return map;
                }, new Map());
                return {members: memberMap, release() {}}
            },
            writeIsTrackingMembers(isTrackingMembers) {
                if (this.isTrackingMembers !== isTrackingMembers) {
                    return isTrackingMembers;
                }
                return undefined;
            },
            applyIsTrackingMembersChanges(isTrackingMembers) {
                if (isTrackingMembers !== undefined) {
                    this.isTrackingMembers = isTrackingMembers;
                }
            },
        }
    }

    function createQueryKeysHSApiMock(createKey = (algorithm, userId, deviceId) => `${algorithm}:${userId}:${deviceId}:key`): HomeServerApi {
        return {
            queryKeys(payload) {
                const {device_keys: deviceKeys} = payload;
                const userKeys = Object.entries(deviceKeys as {[userId: string]: string[]}).reduce((userKeys, [userId, deviceIds]) => {
                    if (deviceIds.length === 0) {
                        deviceIds = ["device1"];
                    }
                    userKeys[userId] = deviceIds.filter(d => d === "device1").reduce((deviceKeys, deviceId) => {
                        deviceKeys[deviceId] = {
                            "algorithms": [
                              "m.olm.v1.curve25519-aes-sha2",
                              "m.megolm.v1.aes-sha2"
                            ],
                            "device_id": deviceId,
                            "keys": {
                                [`curve25519:${deviceId}`]: createKey("curve25519", userId, deviceId),
                                [`ed25519:${deviceId}`]: createKey("ed25519", userId, deviceId),
                            },
                            "signatures": {
                                [userId]: {
                                    [`ed25519:${deviceId}`]: `ed25519:${userId}:${deviceId}:signature`
                                }
                            },
                            "unsigned": {
                              "device_display_name": `${userId} Phone`
                            },
                            "user_id": userId
                        };
                        return deviceKeys;
                    }, {});
                    return userKeys;
                }, {});
                const response = {device_keys: userKeys};
                return {
                    async response() {
                        return response;
                    }
                };
            }
        } as unknown as HomeServerApi;
    }

    async function writeMemberListToStorage(room, storage) {
        const txn = await storage.readWriteTxn([
            storage.storeNames.roomMembers,
        ]);
        const memberList = await room.loadMemberList(txn);
        try {
            for (const member of memberList.members.values()) {
                txn.roomMembers.set(member.serialize());
            }
        } catch (err) {
            txn.abort();
            throw err;
        } finally {
            memberList.release();
        }
        await txn.complete();
    }

    const roomId = "!abc:hs.tld";

    return {
        "trackRoom only writes joined members with history visibility of joined": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}} as unknown as Olm.Utility, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            const room = createUntrackedRoomMock(roomId, ["@alice:hs.tld", "@bob:hs.tld"], ["@charly:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Joined, NullLoggerInstance.item);
            const txn = await storage.readTxn([storage.storeNames.userIdentities]);
            assert.deepEqual(await txn.userIdentities.get("@alice:hs.tld"), {
                userId: "@alice:hs.tld",
                roomIds: [roomId],
                keysTrackingStatus: KeysTrackingStatus.Outdated
            });
            assert.deepEqual(await txn.userIdentities.get("@bob:hs.tld"), {
                userId: "@bob:hs.tld",
                roomIds: [roomId],
                keysTrackingStatus: KeysTrackingStatus.Outdated
            });
            assert.equal(await txn.userIdentities.get("@charly:hs.tld"), undefined);
        },
        "getting devices for tracked room yields correct keys": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}} as unknown as Olm.Utility, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            const room = createUntrackedRoomMock(roomId, ["@alice:hs.tld", "@bob:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Joined, NullLoggerInstance.item);
            const hsApi = createQueryKeysHSApiMock();
            const devices = await tracker.devicesForRoomMembers(roomId, ["@alice:hs.tld", "@bob:hs.tld"], hsApi, NullLoggerInstance.item);
            assert.equal(devices.length, 2);
            assert.equal(getDeviceEd25519Key(devices.find(d => d.user_id === "@alice:hs.tld")!), "ed25519:@alice:hs.tld:device1:key");
            assert.equal(getDeviceEd25519Key(devices.find(d => d.user_id === "@bob:hs.tld")!), "ed25519:@bob:hs.tld:device1:key");
        },
        "device with changed key is ignored": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}} as unknown as Olm.Utility, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            const room = createUntrackedRoomMock(roomId, ["@alice:hs.tld", "@bob:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Joined, NullLoggerInstance.item);
            const hsApi = createQueryKeysHSApiMock();
            // query devices first time
            await tracker.devicesForRoomMembers(roomId, ["@alice:hs.tld", "@bob:hs.tld"], hsApi, NullLoggerInstance.item);
            const txn = await storage.readWriteTxn([storage.storeNames.userIdentities]);
            // mark alice as outdated, so keys will be fetched again
            tracker.writeDeviceChanges(["@alice:hs.tld"], txn, NullLoggerInstance.item);
            await txn.complete();
            const hsApiWithChangedAliceKey = createQueryKeysHSApiMock((algo, userId, deviceId) => {
                return `${algo}:${userId}:${deviceId}:${userId === "@alice:hs.tld" ? "newKey" : "key"}`;
            });
            const devices = await tracker.devicesForRoomMembers(roomId, ["@alice:hs.tld", "@bob:hs.tld"], hsApiWithChangedAliceKey, NullLoggerInstance.item);
            assert.equal(devices.length, 2);
            assert.equal(getDeviceEd25519Key(devices.find(d => d.user_id === "@alice:hs.tld")!), "ed25519:@alice:hs.tld:device1:key");
            assert.equal(getDeviceEd25519Key(devices.find(d => d.user_id === "@bob:hs.tld")!), "ed25519:@bob:hs.tld:device1:key");
            const txn2 = await storage.readTxn([storage.storeNames.deviceKeys]);
            // also check the modified key was not stored
            assert.equal(getDeviceEd25519Key((await txn2.deviceKeys.get("@alice:hs.tld", "device1"))!), "ed25519:@alice:hs.tld:device1:key");
        },
        "change history visibility from joined to invited adds invitees": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}} as unknown as Olm.Utility, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            // alice is joined, bob is invited
            const room = await createUntrackedRoomMock(roomId, 
                ["@alice:hs.tld"], ["@bob:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Joined, NullLoggerInstance.item);
            const txn = await storage.readWriteTxn([storage.storeNames.userIdentities, storage.storeNames.deviceKeys]);
            assert.equal(await txn.userIdentities.get("@bob:hs.tld"), undefined);
            const {added, removed} = await tracker.writeHistoryVisibility(room, HistoryVisibility.Invited, txn, NullLoggerInstance.item);
            assert.equal((await txn.userIdentities.get("@bob:hs.tld"))!.userId, "@bob:hs.tld");
            assert.deepEqual(added, ["@bob:hs.tld"]);
            assert.deepEqual(removed, []);
        },
        "change history visibility from invited to joined removes invitees": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}} as unknown as Olm.Utility, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            // alice is joined, bob is invited
            const room = await createUntrackedRoomMock(roomId, 
                ["@alice:hs.tld"], ["@bob:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Invited, NullLoggerInstance.item);
            const txn = await storage.readWriteTxn([storage.storeNames.userIdentities, storage.storeNames.deviceKeys]);
            assert.equal((await txn.userIdentities.get("@bob:hs.tld"))!.userId, "@bob:hs.tld");
            const {added, removed} = await tracker.writeHistoryVisibility(room, HistoryVisibility.Joined, txn, NullLoggerInstance.item);
            assert.equal(await txn.userIdentities.get("@bob:hs.tld"), undefined);
            assert.deepEqual(added, []);
            assert.deepEqual(removed, ["@bob:hs.tld"]);
        },
        "adding invitee with history visibility of invited adds room to userIdentities": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}} as unknown as Olm.Utility, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            const room = await createUntrackedRoomMock(roomId, ["@alice:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Invited, NullLoggerInstance.item);
            const txn = await storage.readWriteTxn([storage.storeNames.userIdentities, storage.storeNames.deviceKeys]);
            // inviting a new member
            const inviteChange = new MemberChange(RoomMember.fromUserId(roomId, "@bob:hs.tld", "invite"));
            const {added, removed} = await tracker.writeMemberChanges(room, new Map([[inviteChange.userId, inviteChange]]), HistoryVisibility.Invited, txn);
            assert.deepEqual(added, ["@bob:hs.tld"]);
            assert.deepEqual(removed, []);
            assert.equal((await txn.userIdentities.get("@bob:hs.tld"))!.userId, "@bob:hs.tld");
        },
        "adding invitee with history visibility of joined doesn't add room": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}} as unknown as Olm.Utility, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            const room = await createUntrackedRoomMock(roomId, ["@alice:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Joined, NullLoggerInstance.item);
            const txn = await storage.readWriteTxn([storage.storeNames.userIdentities, storage.storeNames.deviceKeys]);
            // inviting a new member
            const inviteChange = new MemberChange(RoomMember.fromUserId(roomId, "@bob:hs.tld", "invite"));
            const memberChanges = new Map([[inviteChange.userId, inviteChange]]);
            const {added, removed} = await tracker.writeMemberChanges(room, memberChanges, HistoryVisibility.Joined, txn);
            assert.deepEqual(added, []);
            assert.deepEqual(removed, []);
            assert.equal(await txn.userIdentities.get("@bob:hs.tld"), undefined);
        },
        "getting all devices after changing history visibility now includes invitees": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}} as unknown as Olm.Utility, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            const room = createUntrackedRoomMock(roomId, ["@alice:hs.tld"], ["@bob:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Invited, NullLoggerInstance.item);
            const hsApi = createQueryKeysHSApiMock();
            // write memberlist from room mock to mock storage,
            // as devicesForTrackedRoom reads directly from roomMembers store.
            await writeMemberListToStorage(room, storage);
            const devices = await tracker.devicesForTrackedRoom(roomId, hsApi, NullLoggerInstance.item);
            assert.equal(devices.length, 2);
            assert.equal(getDeviceEd25519Key(devices.find(d => d.user_id === "@alice:hs.tld")!), "ed25519:@alice:hs.tld:device1:key");
            assert.equal(getDeviceEd25519Key(devices.find(d => d.user_id === "@bob:hs.tld")!), "ed25519:@bob:hs.tld:device1:key");
        },
        "rejecting invite with history visibility of invited removes room from user identity": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}} as unknown as Olm.Utility, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            // alice is joined, bob is invited
            const room = await createUntrackedRoomMock(roomId, ["@alice:hs.tld"], ["@bob:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Invited, NullLoggerInstance.item);
            const txn = await storage.readWriteTxn([storage.storeNames.userIdentities, storage.storeNames.deviceKeys]);
            // reject invite
            const inviteChange = new MemberChange(RoomMember.fromUserId(roomId, "@bob:hs.tld", "leave"), "invite");
            const memberChanges = new Map([[inviteChange.userId, inviteChange]]);
            const {added, removed} = await tracker.writeMemberChanges(room, memberChanges, HistoryVisibility.Invited, txn);
            assert.deepEqual(added, []);
            assert.deepEqual(removed, ["@bob:hs.tld"]);
            assert.equal(await txn.userIdentities.get("@bob:hs.tld"), undefined);
        },
        "remove room from user identity sharing multiple rooms with us preserves other room": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}} as unknown as Olm.Utility, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            // alice is joined, bob is invited
            const room1 = await createUntrackedRoomMock("!abc:hs.tld", ["@alice:hs.tld", "@bob:hs.tld"]);
            const room2 = await createUntrackedRoomMock("!def:hs.tld", ["@alice:hs.tld", "@bob:hs.tld"]);
            await tracker.trackRoom(room1, HistoryVisibility.Joined, NullLoggerInstance.item);
            await tracker.trackRoom(room2, HistoryVisibility.Joined, NullLoggerInstance.item);
            const txn1 = await storage.readTxn([storage.storeNames.userIdentities]);
            assert.deepEqual((await txn1.userIdentities.get("@bob:hs.tld"))!.roomIds, ["!abc:hs.tld", "!def:hs.tld"]);
            const leaveChange = new MemberChange(RoomMember.fromUserId(room2.id, "@bob:hs.tld", "leave"), "join");
            const memberChanges = new Map([[leaveChange.userId, leaveChange]]);
            const txn2 = await storage.readWriteTxn([storage.storeNames.userIdentities, storage.storeNames.deviceKeys]);
            await tracker.writeMemberChanges(room2, memberChanges, HistoryVisibility.Joined, txn2);
            await txn2.complete();
            const txn3 = await storage.readTxn([storage.storeNames.userIdentities]);
            assert.deepEqual((await txn3.userIdentities.get("@bob:hs.tld"))!.roomIds, ["!abc:hs.tld"]);
        },
        "add room to user identity sharing multiple rooms with us preserves other room": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}} as unknown as Olm.Utility, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            // alice is joined, bob is invited
            const room1 = await createUntrackedRoomMock("!abc:hs.tld", ["@alice:hs.tld", "@bob:hs.tld"]);
            const room2 = await createUntrackedRoomMock("!def:hs.tld", ["@alice:hs.tld", "@bob:hs.tld"]);
            await tracker.trackRoom(room1, HistoryVisibility.Joined, NullLoggerInstance.item);
            const txn1 = await storage.readTxn([storage.storeNames.userIdentities]);
            assert.deepEqual((await txn1.userIdentities.get("@bob:hs.tld"))!.roomIds, ["!abc:hs.tld"]);
            await tracker.trackRoom(room2, HistoryVisibility.Joined, NullLoggerInstance.item);
            const txn2 = await storage.readTxn([storage.storeNames.userIdentities]);
            assert.deepEqual((await txn2.userIdentities.get("@bob:hs.tld"))!.roomIds, ["!abc:hs.tld", "!def:hs.tld"]);
        },
        "devicesForUsers fetches users even though they aren't in any tracked room": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}} as unknown as Olm.Utility, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            const hsApi = createQueryKeysHSApiMock();
            const devices = await tracker.devicesForUsers(["@bob:hs.tld"], hsApi, NullLoggerInstance.item);
            assert.equal(devices.length, 1);
            assert.equal(getDeviceCurve25519Key(devices[0]), "curve25519:@bob:hs.tld:device1:key");
            const txn1 = await storage.readTxn([storage.storeNames.userIdentities]);
            assert.deepEqual((await txn1.userIdentities.get("@bob:hs.tld"))!.roomIds, []);
        },
        "devicesForUsers doesn't add any roomId when creating userIdentity": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}} as unknown as Olm.Utility, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            const hsApi = createQueryKeysHSApiMock();
            await tracker.devicesForUsers(["@bob:hs.tld"], hsApi, NullLoggerInstance.item);
            const txn1 = await storage.readTxn([storage.storeNames.userIdentities]);
            assert.deepEqual((await txn1.userIdentities.get("@bob:hs.tld"))!.roomIds, []);
        }
    }
}
