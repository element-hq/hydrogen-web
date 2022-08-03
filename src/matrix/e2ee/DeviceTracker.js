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

import {verifyEd25519Signature, SIGNATURE_ALGORITHM} from "./common.js";
import {HistoryVisibility, shouldShareKey} from "./common.js";
import {RoomMember} from "../room/members/RoomMember.js";

const TRACKING_STATUS_OUTDATED = 0;
const TRACKING_STATUS_UPTODATE = 1;

function addRoomToIdentity(identity, userId, roomId) {
    if (!identity) {
        identity = {
            userId: userId,
            roomIds: [roomId],
            deviceTrackingStatus: TRACKING_STATUS_OUTDATED,
        };
        return identity;
    } else {
        if (!identity.roomIds.includes(roomId)) {
            identity.roomIds.push(roomId);
            return identity;
        }
    }
}

// map 1 device from /keys/query response to DeviceIdentity
function deviceKeysAsDeviceIdentity(deviceSection) {
    const deviceId = deviceSection["device_id"];
    const userId = deviceSection["user_id"];
    return {
        userId,
        deviceId,
        ed25519Key: deviceSection.keys[`ed25519:${deviceId}`],
        curve25519Key: deviceSection.keys[`curve25519:${deviceId}`],
        algorithms: deviceSection.algorithms,
        displayName: deviceSection.unsigned?.device_display_name,
    };
}

export class DeviceTracker {
    constructor({storage, getSyncToken, olmUtil, ownUserId, ownDeviceId}) {
        this._storage = storage;
        this._getSyncToken = getSyncToken;
        this._identityChangedForRoom = null;
        this._olmUtil = olmUtil;
        this._ownUserId = ownUserId;
        this._ownDeviceId = ownDeviceId;
    }

    async writeDeviceChanges(changed, txn, log) {
        const {userIdentities} = txn;
        // TODO: should we also look at left here to handle this?:
        // the usual problem here is that you share a room with a user,
        // go offline, the remote user leaves the room, changes their devices,
        // then rejoins the room you share (or another room).
        // At which point you come online, all of this happens in the gap, 
        // and you don't notice that they ever left, 
        // and so the client doesn't invalidate their device cache for the user
        log.set("changed", changed.length);
        await Promise.all(changed.map(async userId => {
            const user = await userIdentities.get(userId);
            if (user) {
                log.log({l: "outdated", id: userId});
                user.deviceTrackingStatus = TRACKING_STATUS_OUTDATED;
                userIdentities.set(user);
            }
        }));
    }

    /** @return Promise<{added: string[], removed: string[]}> the user ids for who the room was added or removed to the userIdentity,
     *                                                        and with who a key should be now be shared
     **/
    async writeMemberChanges(room, memberChanges, historyVisibility, txn) {
        const added = [];
        const removed = [];
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

    async trackRoom(room, historyVisibility, log) {
        if (room.isTrackingMembers || !room.isEncrypted) {
            return;
        }
        const memberList = await room.loadMemberList(undefined, log);
        const txn = await this._storage.readWriteTxn([
            this._storage.storeNames.roomSummary,
            this._storage.storeNames.userIdentities,
        ]);
        try {
            let isTrackingChanges;
            try {
                isTrackingChanges = room.writeIsTrackingMembers(true, txn);
                const members = Array.from(memberList.members.values());
                log.set("members", members.length);
                await Promise.all(members.map(async member => {
                    if (shouldShareKey(member.membership, historyVisibility)) {
                        await this._addRoomToUserIdentity(member.roomId, member.userId, txn);
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

    async writeHistoryVisibility(room, historyVisibility, syncTxn, log) {
        const added = [];
        const removed = [];
        if (room.isTrackingMembers && room.isEncrypted) {
            await log.wrap("rewriting userIdentities", async log => {
                const memberList = await room.loadMemberList(syncTxn, log);
                try {
                    const members = Array.from(memberList.members.values());
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

    async _addRoomToUserIdentity(roomId, userId, txn) {
        const {userIdentities} = txn;
        const identity = await userIdentities.get(userId);
        const updatedIdentity = addRoomToIdentity(identity, userId, roomId);
        if (updatedIdentity) {
            userIdentities.set(updatedIdentity);
            return true;
        }
        return false;
    }

    async _removeRoomFromUserIdentity(roomId, userId, txn) {
        const {userIdentities, deviceIdentities} = txn;
        const identity = await userIdentities.get(userId);
        if (identity) {
            identity.roomIds = identity.roomIds.filter(id => id !== roomId);
            // no more encrypted rooms with this user, remove
            if (identity.roomIds.length === 0) {
                userIdentities.remove(userId);
                deviceIdentities.removeAllForUser(userId);
            } else {
                userIdentities.set(identity);
            }
            return true;
        }
        return false;
    }

    async _queryKeys(userIds, hsApi, log) {
        // TODO: we need to handle the race here between /sync and /keys/query just like we need to do for the member list ...
        // there are multiple requests going out for /keys/query though and only one for /members

        const deviceKeyResponse = await hsApi.queryKeys({
            "timeout": 10000,
            "device_keys": userIds.reduce((deviceKeysMap, userId) => {
                deviceKeysMap[userId] = [];
                return deviceKeysMap;
            }, {}),
            "token": this._getSyncToken()
        }, {log}).response();

        const verifiedKeysPerUser = log.wrap("verify", log => this._filterVerifiedDeviceKeys(deviceKeyResponse["device_keys"], log));
        const txn = await this._storage.readWriteTxn([
            this._storage.storeNames.userIdentities,
            this._storage.storeNames.deviceIdentities,
        ]);
        let deviceIdentities;
        try {
            const devicesIdentitiesPerUser = await Promise.all(verifiedKeysPerUser.map(async ({userId, verifiedKeys}) => {
                const deviceIdentities = verifiedKeys.map(deviceKeysAsDeviceIdentity);
                return await this._storeQueriedDevicesForUserId(userId, deviceIdentities, txn);
            }));
            deviceIdentities = devicesIdentitiesPerUser.reduce((all, devices) => all.concat(devices), []);
            log.set("devices", deviceIdentities.length);
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
        return deviceIdentities;
    }

    async _storeQueriedDevicesForUserId(userId, deviceIdentities, txn) {
        const knownDeviceIds = await txn.deviceIdentities.getAllDeviceIds(userId);
        // delete any devices that we know off but are not in the response anymore.
        // important this happens before checking if the ed25519 key changed,
        // otherwise we would end up deleting existing devices with changed keys.
        for (const deviceId of knownDeviceIds) {
            if (deviceIdentities.every(di => di.deviceId !== deviceId)) {
                txn.deviceIdentities.remove(userId, deviceId);
            }
        }

        // all the device identities as we will have them in storage
        const allDeviceIdentities = [];
        const deviceIdentitiesToStore = [];
        // filter out devices that have changed their ed25519 key since last time we queried them
        await Promise.all(deviceIdentities.map(async deviceIdentity => {
            if (knownDeviceIds.includes(deviceIdentity.deviceId)) {
                const existingDevice = await txn.deviceIdentities.get(deviceIdentity.userId, deviceIdentity.deviceId);
                if (existingDevice.ed25519Key !== deviceIdentity.ed25519Key) {
                    allDeviceIdentities.push(existingDevice);
                    return;
                }
            }
            allDeviceIdentities.push(deviceIdentity);
            deviceIdentitiesToStore.push(deviceIdentity);
        }));
        // store devices
        for (const deviceIdentity of deviceIdentitiesToStore) {
            txn.deviceIdentities.set(deviceIdentity);
        }
        // mark user identities as up to date
        const identity = await txn.userIdentities.get(userId);
        identity.deviceTrackingStatus = TRACKING_STATUS_UPTODATE;
        txn.userIdentities.set(identity);

        return allDeviceIdentities;
    }

    /**
     * @return {Array<{userId, verifiedKeys: Array<DeviceSection>>}
     */
    _filterVerifiedDeviceKeys(keyQueryDeviceKeysResponse, parentLog) {
        const curve25519Keys = new Set();
        const verifiedKeys = Object.entries(keyQueryDeviceKeysResponse).map(([userId, keysByDevice]) => {
            const verifiedEntries = Object.entries(keysByDevice).filter(([deviceId, deviceKeys]) => {
                const deviceIdOnKeys = deviceKeys["device_id"];
                const userIdOnKeys = deviceKeys["user_id"];
                if (userIdOnKeys !== userId) {
                    return false;
                }
                if (deviceIdOnKeys !== deviceId) {
                    return false;
                }
                const ed25519Key = deviceKeys.keys?.[`ed25519:${deviceId}`];
                const curve25519Key = deviceKeys.keys?.[`curve25519:${deviceId}`];
                if (typeof ed25519Key !== "string" || typeof curve25519Key !== "string") {
                    return false;
                }
                if (curve25519Keys.has(curve25519Key)) {
                    parentLog.log({
                        l: "ignore device with duplicate curve25519 key",
                        keys: deviceKeys
                    }, parentLog.level.Warn);
                    return false;
                }
                curve25519Keys.add(curve25519Key);
                const isValid = this._hasValidSignature(deviceKeys, parentLog);
                if (!isValid) {
                    parentLog.log({
                        l: "ignore device with invalid signature",
                        keys: deviceKeys
                    }, parentLog.level.Warn);
                }
                return isValid;
            });
            const verifiedKeys = verifiedEntries.map(([, deviceKeys]) => deviceKeys);
            return {userId, verifiedKeys};
        });
        return verifiedKeys;
    }

    _hasValidSignature(deviceSection, parentLog) {
        const deviceId = deviceSection["device_id"];
        const userId = deviceSection["user_id"];
        const ed25519Key = deviceSection?.keys?.[`${SIGNATURE_ALGORITHM}:${deviceId}`];
        return verifyEd25519Signature(this._olmUtil, userId, deviceId, ed25519Key, deviceSection, parentLog);
    }

    /**
     * Gives all the device identities for a room that is already tracked.
     * Assumes room is already tracked. Call `trackRoom` first if unsure.
     * @param  {String} roomId [description]
     * @return {[type]}        [description]
     */
    async devicesForTrackedRoom(roomId, hsApi, log) {
        const txn = await this._storage.readTxn([
            this._storage.storeNames.roomMembers,
            this._storage.storeNames.userIdentities,
        ]);

        // because we don't have multiEntry support in IE11, we get a set of userIds that is pretty close to what we
        // need as a good first filter (given that non-join memberships will be in there). After fetching the identities,
        // we check which ones have the roomId for the room we're looking at.
        
        // So, this will also contain non-joined memberships
        const userIds = await txn.roomMembers.getAllUserIds(roomId);

        return await this._devicesForUserIds(roomId, userIds, txn, hsApi, log);
    }

    async devicesForRoomMembers(roomId, userIds, hsApi, log) {
        const txn = await this._storage.readTxn([
            this._storage.storeNames.userIdentities,
        ]);
        return await this._devicesForUserIds(roomId, userIds, txn, hsApi, log);
    }

    /**
     * @param  {string} roomId  [description]
     * @param  {Array<string>} userIds a set of user ids to try and find the identity for. Will be check to belong to roomId.
     * @param  {Transaction} userIdentityTxn to read the user identities
     * @param  {HomeServerApi} hsApi
     * @return {Array<DeviceIdentity>}
     */
    async _devicesForUserIds(roomId, userIds, userIdentityTxn, hsApi, log) {
        const allMemberIdentities = await Promise.all(userIds.map(userId => userIdentityTxn.userIdentities.get(userId)));
        const identities = allMemberIdentities.filter(identity => {
            // identity will be missing for any userIds that don't have 
            // membership join in any of your encrypted rooms
            return identity && identity.roomIds.includes(roomId);
        });
        const upToDateIdentities = identities.filter(i => i.deviceTrackingStatus === TRACKING_STATUS_UPTODATE);
        const outdatedIdentities = identities.filter(i => i.deviceTrackingStatus === TRACKING_STATUS_OUTDATED);
        log.set("uptodate", upToDateIdentities.length);
        log.set("outdated", outdatedIdentities.length);
        let queriedDevices;
        if (outdatedIdentities.length) {
            // TODO: ignore the race between /sync and /keys/query for now,
            // where users could get marked as outdated or added/removed from the room while
            // querying keys
            queriedDevices = await this._queryKeys(outdatedIdentities.map(i => i.userId), hsApi, log);
        }

        const deviceTxn = await this._storage.readTxn([
            this._storage.storeNames.deviceIdentities,
        ]);
        const devicesPerUser = await Promise.all(upToDateIdentities.map(identity => {
            return deviceTxn.deviceIdentities.getAllForUserId(identity.userId);
        }));
        let flattenedDevices = devicesPerUser.reduce((all, devicesForUser) => all.concat(devicesForUser), []);
        if (queriedDevices && queriedDevices.length) {
            flattenedDevices = flattenedDevices.concat(queriedDevices);
        }
        // filter out our own device
        const devices = flattenedDevices.filter(device => {
            const isOwnDevice = device.userId === this._ownUserId && device.deviceId === this._ownDeviceId;
            return !isOwnDevice;
        });
        return devices;
    }

    async getDeviceByCurve25519Key(curve25519Key, txn) {
        return await txn.deviceIdentities.getByCurve25519Key(curve25519Key);
    }
}

import {createMockStorage} from "../../mocks/Storage";
import {Instance as NullLoggerInstance} from "../../logging/NullLogger";
import {MemberChange} from "../room/members/RoomMember";

export function tests() {

    function createUntrackedRoomMock(roomId, joinedUserIds, invitedUserIds = []) {
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

    function createQueryKeysHSApiMock(createKey = (algorithm, userId, deviceId) => `${algorithm}:${userId}:${deviceId}:key`) {
        return {
            queryKeys(payload) {
                const {device_keys: deviceKeys} = payload;
                const userKeys = Object.entries(deviceKeys).reduce((userKeys, [userId, deviceIds]) => {
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
        };
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
                olmUtil: {ed25519_verify: () => {}}, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            const room = createUntrackedRoomMock(roomId, ["@alice:hs.tld", "@bob:hs.tld"], ["@charly:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Joined, NullLoggerInstance.item);
            const txn = await storage.readTxn([storage.storeNames.userIdentities]);
            assert.deepEqual(await txn.userIdentities.get("@alice:hs.tld"), {
                userId: "@alice:hs.tld",
                roomIds: [roomId],
                deviceTrackingStatus: TRACKING_STATUS_OUTDATED
            });
            assert.deepEqual(await txn.userIdentities.get("@bob:hs.tld"), {
                userId: "@bob:hs.tld",
                roomIds: [roomId],
                deviceTrackingStatus: TRACKING_STATUS_OUTDATED
            });
            assert.equal(await txn.userIdentities.get("@charly:hs.tld"), undefined);
        },
        "getting devices for tracked room yields correct keys": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}}, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            const room = createUntrackedRoomMock(roomId, ["@alice:hs.tld", "@bob:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Joined, NullLoggerInstance.item);
            const hsApi = createQueryKeysHSApiMock();
            const devices = await tracker.devicesForRoomMembers(roomId, ["@alice:hs.tld", "@bob:hs.tld"], hsApi, NullLoggerInstance.item);
            assert.equal(devices.length, 2);
            assert.equal(devices.find(d => d.userId === "@alice:hs.tld").ed25519Key, "ed25519:@alice:hs.tld:device1:key");
            assert.equal(devices.find(d => d.userId === "@bob:hs.tld").ed25519Key, "ed25519:@bob:hs.tld:device1:key");
        },
        "device with changed key is ignored": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}}, // valid if it does not throw
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
            assert.equal(devices.find(d => d.userId === "@alice:hs.tld").ed25519Key, "ed25519:@alice:hs.tld:device1:key");
            assert.equal(devices.find(d => d.userId === "@bob:hs.tld").ed25519Key, "ed25519:@bob:hs.tld:device1:key");
            const txn2 = await storage.readTxn([storage.storeNames.deviceIdentities]);
            // also check the modified key was not stored
            assert.equal((await txn2.deviceIdentities.get("@alice:hs.tld", "device1")).ed25519Key, "ed25519:@alice:hs.tld:device1:key");
        },
        "change history visibility from joined to invited adds invitees": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}}, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            // alice is joined, bob is invited
            const room = await createUntrackedRoomMock(roomId, 
                ["@alice:hs.tld"], ["@bob:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Joined, NullLoggerInstance.item);
            const txn = await storage.readWriteTxn([storage.storeNames.userIdentities, storage.storeNames.deviceIdentities]);
            assert.equal(await txn.userIdentities.get("@bob:hs.tld"), undefined);
            const {added, removed} = await tracker.writeHistoryVisibility(room, HistoryVisibility.Invited, txn, NullLoggerInstance.item);
            assert.equal((await txn.userIdentities.get("@bob:hs.tld")).userId, "@bob:hs.tld");
            assert.deepEqual(added, ["@bob:hs.tld"]);
            assert.deepEqual(removed, []);
        },
        "change history visibility from invited to joined removes invitees": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}}, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            // alice is joined, bob is invited
            const room = await createUntrackedRoomMock(roomId, 
                ["@alice:hs.tld"], ["@bob:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Invited, NullLoggerInstance.item);
            const txn = await storage.readWriteTxn([storage.storeNames.userIdentities, storage.storeNames.deviceIdentities]);
            assert.equal((await txn.userIdentities.get("@bob:hs.tld")).userId, "@bob:hs.tld");
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
                olmUtil: {ed25519_verify: () => {}}, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            const room = await createUntrackedRoomMock(roomId, ["@alice:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Invited, NullLoggerInstance.item);
            const txn = await storage.readWriteTxn([storage.storeNames.userIdentities, storage.storeNames.deviceIdentities]);
            // inviting a new member
            const inviteChange = new MemberChange(RoomMember.fromUserId(roomId, "@bob:hs.tld", "invite"));
            const {added, removed} = await tracker.writeMemberChanges(room, [inviteChange], HistoryVisibility.Invited, txn);
            assert.deepEqual(added, ["@bob:hs.tld"]);
            assert.deepEqual(removed, []);
            assert.equal((await txn.userIdentities.get("@bob:hs.tld")).userId, "@bob:hs.tld");
        },
        "adding invitee with history visibility of joined doesn't add room": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}}, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            const room = await createUntrackedRoomMock(roomId, ["@alice:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Joined, NullLoggerInstance.item);
            const txn = await storage.readWriteTxn([storage.storeNames.userIdentities, storage.storeNames.deviceIdentities]);
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
                olmUtil: {ed25519_verify: () => {}}, // valid if it does not throw
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
            assert.equal(devices.find(d => d.userId === "@alice:hs.tld").ed25519Key, "ed25519:@alice:hs.tld:device1:key");
            assert.equal(devices.find(d => d.userId === "@bob:hs.tld").ed25519Key, "ed25519:@bob:hs.tld:device1:key");
        },
        "rejecting invite with history visibility of invited removes room from user identity": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}}, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            // alice is joined, bob is invited
            const room = await createUntrackedRoomMock(roomId, ["@alice:hs.tld"], ["@bob:hs.tld"]);
            await tracker.trackRoom(room, HistoryVisibility.Invited, NullLoggerInstance.item);
            const txn = await storage.readWriteTxn([storage.storeNames.userIdentities, storage.storeNames.deviceIdentities]);
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
                olmUtil: {ed25519_verify: () => {}}, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            // alice is joined, bob is invited
            const room1 = await createUntrackedRoomMock("!abc:hs.tld", ["@alice:hs.tld", "@bob:hs.tld"]);
            const room2 = await createUntrackedRoomMock("!def:hs.tld", ["@alice:hs.tld", "@bob:hs.tld"]);
            await tracker.trackRoom(room1, HistoryVisibility.Joined, NullLoggerInstance.item);
            await tracker.trackRoom(room2, HistoryVisibility.Joined, NullLoggerInstance.item);
            const txn1 = await storage.readTxn([storage.storeNames.userIdentities]);
            assert.deepEqual((await txn1.userIdentities.get("@bob:hs.tld")).roomIds, ["!abc:hs.tld", "!def:hs.tld"]);
            const leaveChange = new MemberChange(RoomMember.fromUserId(room2.id, "@bob:hs.tld", "leave"), "join");
            const memberChanges = new Map([[leaveChange.userId, leaveChange]]);
            const txn2 = await storage.readWriteTxn([storage.storeNames.userIdentities, storage.storeNames.deviceIdentities]);
            await tracker.writeMemberChanges(room2, memberChanges, HistoryVisibility.Joined, txn2);
            await txn2.complete();
            const txn3 = await storage.readTxn([storage.storeNames.userIdentities]);
            assert.deepEqual((await txn3.userIdentities.get("@bob:hs.tld")).roomIds, ["!abc:hs.tld"]);
        },
        "add room to user identity sharing multiple rooms with us preserves other room": async assert => {
            const storage = await createMockStorage();
            const tracker = new DeviceTracker({
                storage,
                getSyncToken: () => "token",
                olmUtil: {ed25519_verify: () => {}}, // valid if it does not throw
                ownUserId: "@alice:hs.tld",
                ownDeviceId: "ABCD",
            });
            // alice is joined, bob is invited
            const room1 = await createUntrackedRoomMock("!abc:hs.tld", ["@alice:hs.tld", "@bob:hs.tld"]);
            const room2 = await createUntrackedRoomMock("!def:hs.tld", ["@alice:hs.tld", "@bob:hs.tld"]);
            await tracker.trackRoom(room1, HistoryVisibility.Joined, NullLoggerInstance.item);
            const txn1 = await storage.readTxn([storage.storeNames.userIdentities]);
            assert.deepEqual((await txn1.userIdentities.get("@bob:hs.tld")).roomIds, ["!abc:hs.tld"]);
            await tracker.trackRoom(room2, HistoryVisibility.Joined, NullLoggerInstance.item);
            const txn2 = await storage.readTxn([storage.storeNames.userIdentities]);
            assert.deepEqual((await txn2.userIdentities.get("@bob:hs.tld")).roomIds, ["!abc:hs.tld", "!def:hs.tld"]);
        },
    }
}
