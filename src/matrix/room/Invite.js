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

import {EventEmitter} from "../../utils/EventEmitter";
import {SummaryData, processStateEvent} from "./RoomSummary.js";
import {Heroes} from "./members/Heroes.js";
import {MemberChange, RoomMember, EVENT_TYPE as MEMBER_EVENT_TYPE} from "./members/RoomMember.js";

export class Invite extends EventEmitter {
    constructor({roomId, user, hsApi, mediaRepository, emitCollectionRemove, emitCollectionUpdate, platform}) {
        super();
        this._roomId = roomId;
        this._user = user;
        this._hsApi = hsApi;
        this._emitCollectionRemove = emitCollectionRemove;
        this._emitCollectionUpdate = emitCollectionUpdate;
        this._mediaRepository = mediaRepository;
        this._platform = platform;
        this._inviteData = null;
        this._accepting = false;
        this._rejecting = false;
        this._accepted = false;
        this._rejected = false;
    }

    get isInvite() {
        return true;
    }

    get id() {
        return this._roomId;
    }

    get name() {
        return this._inviteData.name || this._inviteData.canonicalAlias;
    }

    get isDirectMessage() {
        return this._inviteData.isDirectMessage;
    }

    get avatarUrl() {
        return this._inviteData.avatarUrl;
    }

    /** @see BaseRoom.avatarColorId */
    get avatarColorId() {
        return this._inviteData.avatarColorId || this.id;
    }

    get timestamp() {
        return this._inviteData.timestamp;
    }

    get isEncrypted() {
        return this._inviteData.isEncrypted;
    }

    get inviter() {
        return this._inviter;
    }

    isDirectMessageForUserId(userId) {
        return this.isDirectMessage && this._inviter.userId === userId;
    }

    get isPublic() {
        return this._inviteData.joinRule === "public";
    }

    get canonicalAlias() {
        return this._inviteData.canonicalAlias;
    }

    async accept(log = null) {
        await this._platform.logger.wrapOrRun(log, "acceptInvite", async log => {
            this._accepting = true;
            this._emitChange("accepting");
            await this._hsApi.join(this._roomId, {log}).response();
        });
    }

    async reject(log = null) {
        await this._platform.logger.wrapOrRun(log, "rejectInvite", async log => {
            this._rejecting = true;
            this._emitChange("rejecting");
            await this._hsApi.leave(this._roomId, {log}).response();
        });
    }

    get accepting() {
        return this._accepting;
    }

    get accepted() {
        return this._accepted;
    }

    get rejecting() {
        return this._rejecting;
    }

    get rejected() {
        return this._rejected;
    }

    get mediaRepository() {
        return this._mediaRepository;
    }

    _emitChange(params) {
        this.emit("change");
        this._emitCollectionUpdate(this, params);
    }

    load(inviteData, log) {
        log.set("id", this.id);
        this._inviteData = inviteData;
        this._inviter = inviteData.inviter ? new RoomMember(inviteData.inviter) : null;
    }

    async writeSync(membership, roomResponse, txn, log) {
        if (membership === "invite") {
            log.set("id", this.id);
            log.set("add", true);
            const inviteState = roomResponse["invite_state"]?.events;
            if (!Array.isArray(inviteState)) {
                return null;
            }
            const summaryData = this._createSummaryData(inviteState);
            let heroes;
            if (!summaryData.name && !summaryData.canonicalAlias) {
                heroes = await this._createHeroes(inviteState, log);
            }
            const myInvite = this._getMyInvite(inviteState);
            if (!myInvite) {
                return null;
            }
            const inviter = this._getInviter(myInvite, inviteState);
            const inviteData = this._createData(inviteState, myInvite, inviter, summaryData, heroes);
            txn.invites.set(inviteData);
            return {inviteData, inviter};
        } else {
            log.set("id", this.id);
            log.set("membership", membership);
            txn.invites.remove(this.id);
            return {removed: true, membership};
        }
    }

    afterSync(changes, log) {
        log.set("id", this.id);
        if (changes) {
            if (changes.removed) {
                this._accepting = false;
                this._rejecting = false;
                if (changes.membership === "join") {
                    this._accepted = true;
                } else {
                    this._rejected = true;
                }
                this.emit("change");
            } else {
                // no emit change, adding to the collection is done by sync
                this._inviteData = changes.inviteData;
                this._inviter = changes.inviter;
            }
        }
    }

    _createData(inviteState, myInvite, inviter, summaryData, heroes) {
        const name = heroes ? heroes.roomName : summaryData.name;
        const avatarUrl = heroes ? heroes.roomAvatarUrl : summaryData.avatarUrl;
        const avatarColorId = heroes?.roomAvatarColorId || this.id;
        return {
            roomId: this.id,
            isEncrypted: !!summaryData.encryption,
            isDirectMessage: summaryData.isDirectMessage,
//            type: 
            name,
            avatarUrl,
            avatarColorId,
            canonicalAlias: summaryData.canonicalAlias,
            timestamp: this._platform.clock.now(),
            joinRule: this._getJoinRule(inviteState),
            inviter: inviter?.serialize(),
        };
    }

    _createSummaryData(inviteState) {
        return inviteState.reduce((data, event) => processStateEvent(data, event, this._user.id), new SummaryData(null, this.id));
    }

    async _createHeroes(inviteState, log) {
        const members = inviteState.filter(e => e.type === MEMBER_EVENT_TYPE);
        const otherMembers = members.filter(e => e.state_key !== this._user.id);
        const memberChanges = otherMembers.reduce((map, e) => {
            const member = RoomMember.fromMemberEvent(this.id, e);
            map.set(member.userId, new MemberChange(member, null));
            return map;
        }, new Map());
        const otherUserIds = otherMembers.map(e => e.state_key);
        const heroes = new Heroes(this.id);
        const changes = await heroes.calculateChanges(otherUserIds, memberChanges, null);
        // we don't get an actual lazy-loading m.heroes summary on invites,
        // so just count the members by hand
        const countSummary = new SummaryData(null, this.id);
        countSummary.joinCount = members.reduce((sum, e) => sum + (e.content?.membership === "join" ? 1 : 0), 0);
        countSummary.inviteCount = members.reduce((sum, e) => sum + (e.content?.membership === "invite" ? 1 : 0), 0);
        heroes.applyChanges(changes, countSummary, log);
        return heroes;
    }

    _getMyInvite(inviteState) {
        return inviteState.find(e => e.type === MEMBER_EVENT_TYPE && e.state_key === this._user.id);
    }

    _getInviter(myInvite, inviteState) {
        const inviterMemberEvent = inviteState.find(e => e.type === MEMBER_EVENT_TYPE && e.state_key === myInvite.sender);
        if (inviterMemberEvent) {
            return RoomMember.fromMemberEvent(this.id, inviterMemberEvent);
        }
    }

    _getJoinRule(inviteState) {
        const event = inviteState.find(e => e.type === "m.room.join_rules");
        if (event) {
            return event.content?.join_rule;
        }
        return null;
    }
}

import {NullLogItem} from "../../logging/NullLogger";
import {Clock as MockClock} from "../../mocks/Clock.js";
import {default as roomInviteFixture} from "../../fixtures/matrix/invites/room.js";
import {default as dmInviteFixture} from "../../fixtures/matrix/invites/dm.js";

export function tests() {

    function createStorage() {
        const invitesMap = new Map();
        return {
            invitesMap,
            invites: {
                set(invite) {
                    invitesMap.set(invite.roomId, invite);
                },
                remove(roomId) {
                    invitesMap.delete(roomId);
                }
            }
        }
    }

    const roomId = "!123:hs.tld";
    const aliceAvatarUrl = "mxc://hs.tld/def456";
    const roomAvatarUrl = "mxc://hs.tld/roomavatar";

    return {
        "invite for room has correct fields": async assert => {
            const invite = new Invite({
                roomId,
                platform: {clock: new MockClock(1001)},
                user: {id: "@bob:hs.tld"}
            });
            const txn = createStorage();
            const changes = await invite.writeSync("invite", roomInviteFixture, txn, new NullLogItem());
            assert.equal(txn.invitesMap.get(roomId).roomId, roomId);
            invite.afterSync(changes, new NullLogItem());
            assert.equal(invite.name, "Invite example");
            assert.equal(invite.avatarUrl, roomAvatarUrl);
            assert.equal(invite.isPublic, false);
            assert.equal(invite.timestamp, 1001);
            assert.equal(invite.isEncrypted, false);
            assert.equal(invite.isDirectMessage, false);
            assert(invite.inviter);
            assert.equal(invite.inviter.userId, "@alice:hs.tld");
            assert.equal(invite.inviter.displayName, "Alice");
            assert.equal(invite.inviter.avatarUrl, aliceAvatarUrl);
        },
        "invite for encrypted DM has correct fields": async assert => {
            const invite = new Invite({
                roomId,
                platform: {clock: new MockClock(1003)},
                user: {id: "@bob:hs.tld"}
            });
            const txn = createStorage();
            const changes = await invite.writeSync("invite", dmInviteFixture, txn, new NullLogItem());
            assert.equal(txn.invitesMap.get(roomId).roomId, roomId);
            invite.afterSync(changes, new NullLogItem());
            assert.equal(invite.name, "Alice");
            assert.equal(invite.avatarUrl, aliceAvatarUrl);
            assert.equal(invite.timestamp, 1003);
            assert.equal(invite.isEncrypted, true);
            assert.equal(invite.isDirectMessage, true);
            assert(invite.inviter);
            assert.equal(invite.inviter.userId, "@alice:hs.tld");
            assert.equal(invite.inviter.displayName, "Alice");
            assert.equal(invite.inviter.avatarUrl, aliceAvatarUrl);
        },
        "load persisted invite has correct fields": async assert => {
            const writeInvite = new Invite({
                roomId,
                platform: {clock: new MockClock(1003)},
                user: {id: "@bob:hs.tld"}
            });
            const txn = createStorage();
            await writeInvite.writeSync("invite", dmInviteFixture, txn, new NullLogItem());
            const invite = new Invite({roomId});
            invite.load(txn.invitesMap.get(roomId), new NullLogItem());
            assert.equal(invite.name, "Alice");
            assert.equal(invite.avatarUrl, aliceAvatarUrl);
            assert.equal(invite.timestamp, 1003);
            assert.equal(invite.isEncrypted, true);
            assert.equal(invite.isDirectMessage, true);
            assert(invite.inviter);
            assert.equal(invite.inviter.userId, "@alice:hs.tld");
            assert.equal(invite.inviter.displayName, "Alice");
            assert.equal(invite.inviter.avatarUrl, aliceAvatarUrl);
        },
        "syncing join sets accepted": async assert => {
            let changeEmitCount = 0;
            const invite = new Invite({
                roomId,
                platform: {clock: new MockClock(1003)},
                user: {id: "@bob:hs.tld"},
            });
            invite.on("change", () => { changeEmitCount += 1; });
            const txn = createStorage();
            const changes = await invite.writeSync("invite", dmInviteFixture, txn, new NullLogItem());
            assert.equal(txn.invitesMap.get(roomId).roomId, roomId);
            invite.afterSync(changes, new NullLogItem());
            const joinChanges = await invite.writeSync("join", null, txn, new NullLogItem());
            assert.strictEqual(changeEmitCount, 0);
            invite.afterSync(joinChanges, new NullLogItem());
            assert.strictEqual(changeEmitCount, 1);
            assert.equal(txn.invitesMap.get(roomId), undefined);
            assert.equal(invite.rejected, false);
            assert.equal(invite.accepted, true);
        }
    }
}
