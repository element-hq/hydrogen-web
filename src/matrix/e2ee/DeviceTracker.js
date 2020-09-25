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

const TRACKING_STATUS_OUTDATED = 0;
const TRACKING_STATUS_UPTODATE = 1;

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

    async writeDeviceChanges(deviceLists, txn) {
        const {userIdentities} = txn;
        if (Array.isArray(deviceLists.changed) && deviceLists.changed.length) {
            await Promise.all(deviceLists.changed.map(async userId => {
                const user = await userIdentities.get(userId);
                if (user) {
                    user.deviceTrackingStatus = TRACKING_STATUS_OUTDATED;
                    userIdentities.set(user);
                }
            }));
        }
    }

    writeMemberChanges(room, memberChanges, txn) {
        return Promise.all(Array.from(memberChanges.values()).map(async memberChange => {
            return this._applyMemberChange(memberChange, txn);
        }));
    }

    async trackRoom(room) {
        if (room.isTrackingMembers || !room.isEncrypted) {
            return;
        }
        const memberList = await room.loadMemberList();
        try {
            const txn = this._storage.readWriteTxn([
                this._storage.storeNames.roomSummary,
                this._storage.storeNames.userIdentities,
            ]);
            let isTrackingChanges;
            try {
                isTrackingChanges = room.writeIsTrackingMembers(true, txn);
                const members = Array.from(memberList.members.values());
                await this._writeJoinedMembers(members, txn);
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

    async _writeJoinedMembers(members, txn) {
        await Promise.all(members.map(async member => {
            if (member.membership === "join") {
                await this._writeMember(member, txn);
            }
        }));
    }

    async _writeMember(member, txn) {
        const {userIdentities} = txn;
        const identity = await userIdentities.get(member.userId);
        if (!identity) {
            userIdentities.set({
                userId: member.userId,
                roomIds: [member.roomId],
                deviceTrackingStatus: TRACKING_STATUS_OUTDATED,
            });
        } else {
            if (!identity.roomIds.includes(member.roomId)) {
                identity.roomIds.push(member.roomId);
                userIdentities.set(identity);
            }
        }
    }

    async _applyMemberChange(memberChange, txn) {
        // TODO: depends whether we encrypt for invited users??
        // add room
        if (memberChange.previousMembership !== "join" && memberChange.membership === "join") {
            await this._writeMember(memberChange.member, txn);
        }
        // remove room
        else if (memberChange.previousMembership === "join" && memberChange.membership !== "join") {
            const {userIdentities} = txn;
            const identity = await userIdentities.get(memberChange.userId);
            if (identity) {
                identity.roomIds = identity.roomIds.filter(roomId => roomId !== memberChange.roomId);
                // no more encrypted rooms with this user, remove
                if (identity.roomIds.length === 0) {
                    userIdentities.remove(identity.userId);
                } else {
                    userIdentities.set(identity);
                }
            }
        }
    }

    async _queryKeys(userIds, hsApi) {
        // TODO: we need to handle the race here between /sync and /keys/query just like we need to do for the member list ...
        // there are multiple requests going out for /keys/query though and only one for /members

        const deviceKeyResponse = await hsApi.queryKeys({
            "timeout": 10000,
            "device_keys": userIds.reduce((deviceKeysMap, userId) => {
                deviceKeysMap[userId] = [];
                return deviceKeysMap;
            }, {}),
            "token": this._getSyncToken()
        }).response();

        const verifiedKeysPerUser = this._filterVerifiedDeviceKeys(deviceKeyResponse["device_keys"]);
        const txn = this._storage.readWriteTxn([
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
        deviceIdentities = await Promise.all(deviceIdentities.map(async deviceIdentity => {
            if (knownDeviceIds.includes(deviceIdentity.deviceId)) {
                const existingDevice = await txn.deviceIdentities.get(deviceIdentity.userId, deviceIdentity.deviceId);
                if (existingDevice.ed25519Key !== deviceIdentity.ed25519Key) {
                    allDeviceIdentities.push(existingDevice);
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
    _filterVerifiedDeviceKeys(keyQueryDeviceKeysResponse) {
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
                    console.warn("ignoring device with duplicate curve25519 key in /keys/query response", deviceKeys);
                    return false;
                }
                curve25519Keys.add(curve25519Key);
                return this._hasValidSignature(deviceKeys);
            });
            const verifiedKeys = verifiedEntries.map(([, deviceKeys]) => deviceKeys);
            return {userId, verifiedKeys};
        });
        return verifiedKeys;
    }

    _hasValidSignature(deviceSection) {
        const deviceId = deviceSection["device_id"];
        const userId = deviceSection["user_id"];
        const ed25519Key = deviceSection?.keys?.[`${SIGNATURE_ALGORITHM}:${deviceId}`];
        return verifyEd25519Signature(this._olmUtil, userId, deviceId, ed25519Key, deviceSection);
    }

    /**
     * Gives all the device identities for a room that is already tracked.
     * Assumes room is already tracked. Call `trackRoom` first if unsure.
     * @param  {String} roomId [description]
     * @return {[type]}        [description]
     */
    async devicesForTrackedRoom(roomId, hsApi) {
        const txn = this._storage.readTxn([
            this._storage.storeNames.roomMembers,
            this._storage.storeNames.userIdentities,
        ]);

        // because we don't have multiEntry support in IE11, we get a set of userIds that is pretty close to what we
        // need as a good first filter (given that non-join memberships will be in there). After fetching the identities,
        // we check which ones have the roomId for the room we're looking at.
        
        // So, this will also contain non-joined memberships
        const userIds = await txn.roomMembers.getAllUserIds(roomId);

        return await this._devicesForUserIds(roomId, userIds, txn, hsApi);
    }

    async devicesForRoomMembers(roomId, userIds, hsApi) {
        const txn = this._storage.readTxn([
            this._storage.storeNames.userIdentities,
        ]);
        return await this._devicesForUserIds(roomId, userIds, txn, hsApi);
    }

    /**
     * @param  {string} roomId  [description]
     * @param  {Array<string>} userIds a set of user ids to try and find the identity for. Will be check to belong to roomId.
     * @param  {Transaction} userIdentityTxn to read the user identities
     * @param  {HomeServerApi} hsApi
     * @return {Array<DeviceIdentity>}
     */
    async _devicesForUserIds(roomId, userIds, userIdentityTxn, hsApi) {
        const allMemberIdentities = await Promise.all(userIds.map(userId => userIdentityTxn.userIdentities.get(userId)));
        const identities = allMemberIdentities.filter(identity => {
            // identity will be missing for any userIds that don't have 
            // membership join in any of your encrypted rooms
            return identity && identity.roomIds.includes(roomId);
        });
        const upToDateIdentities = identities.filter(i => i.deviceTrackingStatus === TRACKING_STATUS_UPTODATE);
        const outdatedIdentities = identities.filter(i => i.deviceTrackingStatus === TRACKING_STATUS_OUTDATED);
        let queriedDevices;
        if (outdatedIdentities.length) {
            // TODO: ignore the race between /sync and /keys/query for now,
            // where users could get marked as outdated or added/removed from the room while
            // querying keys
            queriedDevices = await this._queryKeys(outdatedIdentities.map(i => i.userId), hsApi);
        }

        const deviceTxn = this._storage.readTxn([
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
