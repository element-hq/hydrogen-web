/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {reduceStateEvents} from "./RoomSummary.js";
import {BaseRoom} from "./BaseRoom.js";
import {RoomMember} from "./members/RoomMember.js";

export class ArchivedRoom extends BaseRoom {
    constructor(options) {
        super(options);
        this._kickDetails = null;
        this._kickedBy = null;
    }

    async _getKickAuthor(sender, txn) {
        const senderMember = await txn.roomMembers.get(this.id, sender);
        if (senderMember) {
            return new RoomMember(senderMember);
        } else {
            return RoomMember.fromUserId(this.id, sender, "join");
        }
    }
    
    async load(archivedRoomSummary, txn, log) {
        const {summary, kickDetails} = archivedRoomSummary;
        this._kickDetails = kickDetails;
        if (this._kickDetails) {
            this._kickedBy = await this._getKickAuthor(this._kickDetails.sender, txn);
        }
        return super.load(summary, txn, log);
    }

    /** @package */
    async writeSync(joinedSummaryData, roomResponse, membership, txn, log) {
        log.set("id", this.id);
        if (membership === "leave") {
            const newKickDetails = findKickDetails(roomResponse, this._user.id);
            if (newKickDetails || joinedSummaryData) {
                const kickDetails = newKickDetails || this._kickDetails;
                let kickedBy;
                if (newKickDetails) {
                    kickedBy = await this._getKickAuthor(newKickDetails.sender, txn);
                }
                const summaryData = joinedSummaryData || this._summary.data;
                txn.archivedRoomSummary.set({
                    summary: summaryData.serialize(),
                    kickDetails,
                });
                return {kickDetails, kickedBy, summaryData};
            }
        } else if (membership === "join") {
            txn.archivedRoomSummary.remove(this.id);
        }
        // always return object
        return {};
    }

    /**
     * @package
     * Called with the changes returned from `writeSync` to apply them and emit changes.
     * No storage or network operations should be done here.
     */
    afterSync({summaryData, kickDetails, kickedBy}, log) {
        log.set("id", this.id);
        if (summaryData) {
            this._summary.applyChanges(summaryData);
        }
        if (kickDetails) {
            this._kickDetails = kickDetails;
        }
        if (kickedBy) {
            this._kickedBy = kickedBy;
        }
        this._emitUpdate();
    }

    getLeaveDetails() {
        if (this.membership === "leave") {
            return {
                isKicked: this._kickDetails?.membership === "leave",
                isBanned: this._kickDetails?.membership === "ban",
                reason: this._kickDetails?.reason,
                sender: this._kickAuthor,
            };
        }
    }

    forget() {

    }
}

function findKickDetails(roomResponse, ownUserId) {
    const kickEvent = reduceStateEvents(roomResponse, (kickEvent, event) => {
        if (event.type === "m.room.member") {
            // did we get kicked?
            if (event.state_key === ownUserId && event.sender !== event.state_key) {
                kickEvent = event;
            }
        }
        return kickEvent;
    }, null);
    if (kickEvent) {
        return {
            // this is different from the room membership in the sync section, which can only be leave
            membership: kickEvent.content?.membership, // could be leave or ban
            reason: kickEvent.content?.reason,
            sender: kickEvent.sender,
        };
    }
}

export function tests() {
    function createMemberEvent(sender, target, membership, reason) {
        return {
            sender,
            state_key: target,
            type: "m.room.member",
            content: { reason, membership }
        };
    }
    const bob = "@bob:hs.tld";
    const alice = "@alice:hs.tld";

    return {
        "ban/kick sets kickDetails from state event": assert => {
            const reason = "Bye!";
            const leaveEvent = createMemberEvent(alice, bob, "ban", reason);
            const kickDetails = findKickDetails({state: {events: [leaveEvent]}}, bob);
            assert.equal(kickDetails.membership, "ban");
            assert.equal(kickDetails.reason, reason);
            assert.equal(kickDetails.sender, alice);
        },
        "ban/kick sets kickDetails from timeline state event, taking precedence over state": assert => {
            const reason = "Bye!";
            const inviteEvent = createMemberEvent(alice, bob, "invite");
            const leaveEvent = createMemberEvent(alice, bob, "ban", reason);
            const kickDetails = findKickDetails({
                state: { events: [inviteEvent] },
                timeline: {events: [leaveEvent] }
            }, bob);
            assert.equal(kickDetails.membership, "ban");
            assert.equal(kickDetails.reason, reason);
            assert.equal(kickDetails.sender, alice);
        },
        "leaving without being kicked doesn't produce kickDetails": assert => {
            const leaveEvent = createMemberEvent(bob, bob, "leave");
            const kickDetails = findKickDetails({state: {events: [leaveEvent]}}, bob);
            assert.equal(kickDetails, null);
        }
    }
}
