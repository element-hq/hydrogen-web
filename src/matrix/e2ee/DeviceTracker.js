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

import anotherjson from "../../../lib/another-json/index.js";

const TRACKING_STATUS_OUTDATED = 0;
const TRACKING_STATUS_UPTODATE = 1;

const DEVICE_KEYS_SIGNATURE_ALGORITHM = "ed25519";

// map 1 device from /keys/query response to DeviceIdentity
function deviceKeysAsDeviceIdentity(deviceSection) {
    const deviceId = deviceSection["device_id"];
    const userId = deviceSection["user_id"];
    return {
        userId,
        deviceId,
        ed25519Key: deviceSection.keys?.[`ed25519:${deviceId}`],
        curve25519Key: deviceSection.keys?.[`curve25519:${deviceId}`],
        algorithms: deviceSection.algorithms,
        displayName: deviceSection.unsigned?.device_display_name,
    };
}

export class DeviceTracker {
    constructor({storage, getSyncToken, olm}) {
        this._storage = storage;
        this._getSyncToken = getSyncToken;
        this._identityChangedForRoom = null;
        this._olmUtil = new olm.Utility();
    }

    async writeDeviceChanges(deviceLists, txn) {
        const {userIdentities} = txn;
        if (Array.isArray(deviceLists.changed) && deviceLists.changed.length) {
            await Promise.all(deviceLists.changed.map(async userId => {
                const user = await userIdentities.get(userId)
                user.deviceTrackingStatus = TRACKING_STATUS_OUTDATED;
                userIdentities.set(user);
            }));
        }
    }

    writeMemberChanges(room, memberChanges, txn) {
        return Promise.all(Array.from(memberChanges.values()).map(async memberChange => {
            return this._applyMemberChange(memberChange, txn);
        }));
    }

    async trackRoom(room) {
        if (room.isTrackingMembers) {
            return;
        }
        const memberList = await room.loadMemberList();
        try {
            const txn = await this._storage.readWriteTxn([
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
        const flattenedVerifiedKeysPerUser = verifiedKeysPerUser.reduce((all, {verifiedKeys}) => all.concat(verifiedKeys), []);
        const deviceIdentitiesWithPossibleChangedKeys = flattenedVerifiedKeysPerUser.map(deviceKeysAsDeviceIdentity);

        const txn = await this._storage.readWriteTxn([
            this._storage.storeNames.userIdentities,
            this._storage.storeNames.deviceIdentities,
        ]);
        let deviceIdentities;
        try {
            // check ed25519 key has not changed if we've seen the device before
            deviceIdentities = await Promise.all(deviceIdentitiesWithPossibleChangedKeys.map(async (deviceIdentity) => {
                const existingDevice = await txn.deviceIdentities.get(deviceIdentity.userId, deviceIdentity.deviceId);
                if (!existingDevice || existingDevice.ed25519Key === deviceIdentity.ed25519Key) {
                    return deviceIdentity;
                }
                // ignore devices where the keys have changed
                return null;
            }));
            // filter out nulls
            deviceIdentities = deviceIdentities.filter(di => !!di);
            // store devices
            for (const deviceIdentity of deviceIdentities) {
                txn.deviceIdentities.set(deviceIdentity);
            }
            // mark user identities as up to date
            await Promise.all(verifiedKeysPerUser.map(async ({userId}) => {
                const identity = await txn.userIdentities.get(userId);
                identity.deviceTrackingStatus = TRACKING_STATUS_UPTODATE;
                txn.userIdentities.set(identity);
            }));
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
        return deviceIdentities;
    }

    _filterVerifiedDeviceKeys(keyQueryDeviceKeysResponse) {
        const verifiedKeys = Object.entries(keyQueryDeviceKeysResponse).map((userId, keysByDevice) => {
            const verifiedKeys = Object.entries(keysByDevice).filter((deviceId, deviceKeys) => {
                const deviceIdOnKeys = deviceKeys["device_id"];
                const userIdOnKeys = deviceKeys["user_id"];
                if (userIdOnKeys !== userId) {
                    return false;
                }
                if (deviceIdOnKeys !== deviceId) {
                    return false;
                }
                return this._verifyUserDeviceKeys(deviceKeys);
            });
            return {userId, verifiedKeys};
        });
        return verifiedKeys;
    }

    _verifyUserDeviceKeys(deviceSection) {
        const deviceId = deviceSection["device_id"];
        const userId = deviceSection["user_id"];
        const clone = Object.assign({}, deviceSection);
        delete clone.unsigned;
        delete clone.signatures;
        const canonicalJson = anotherjson.stringify(clone);
        const key = deviceSection?.keys?.[`${DEVICE_KEYS_SIGNATURE_ALGORITHM}:${deviceId}`];
        const signature = deviceSection?.signatures?.[userId]?.[`${DEVICE_KEYS_SIGNATURE_ALGORITHM}:${deviceId}`];
        try {
            if (!signature) {
                throw new Error("no signature");
            }
            // throws when signature is invalid
            this._olmUtil.ed25519_verify(key, canonicalJson, signature);
            return true;
        } catch (err) {
            console.warn("Invalid device signature, ignoring device.", key, canonicalJson, signature, err);
            return false;
        }
    }

    /**
     * Gives all the device identities for a room that is already tracked.
     * Assumes room is already tracked. Call `trackRoom` first if unsure.
     * @param  {String} roomId [description]
     * @return {[type]}        [description]
     */
    async deviceIdentitiesForTrackedRoom(roomId, hsApi) {
        let identities;
        const txn = await this._storage.readTxn([
            this._storage.storeNames.roomMembers,
            this._storage.storeNames.userIdentities,
        ]);

        // because we don't have multiEntry support in IE11, we get a set of userIds that is pretty close to what we
        // need as a good first filter (given that non-join memberships will be in there). After fetching the identities,
        // we check which ones have the roomId for the room we're looking at.
        
        // So, this will also contain non-joined memberships
        const userIds = await txn.roomMembers.getAllUserIds();
        const allMemberIdentities = await Promise.all(userIds.map(userId => txn.userIdentities.get(userId)));
        identities = allMemberIdentities.filter(identity => {
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
        return flattenedDevices;
    }
}
