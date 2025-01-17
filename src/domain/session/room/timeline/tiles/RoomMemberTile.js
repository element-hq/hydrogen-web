/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {SimpleTile} from "./SimpleTile";

export class RoomMemberTile extends SimpleTile {

    get shape() {
        return "announcement";
    }

    get announcement() {
        const {sender, content, prevContent, stateKey} = this._entry;
        const senderName =  this._entry.displayName || sender;
        const targetName = sender === stateKey ? senderName : (this._entry.content?.displayname || stateKey);
        const membership = content && content.membership;
        const prevMembership = prevContent && prevContent.membership;

        if (prevMembership === "join" && membership === "join") {
            if (content.avatar_url !== prevContent.avatar_url) {
                return `${senderName} changed their avatar`; 
            } else if (content.displayname !== prevContent.displayname) {
                if (!content.displayname) {
                    return `${stateKey} removed their name (${prevContent.displayname})`;
                }
                return `${prevContent.displayname ?? stateKey} changed their name to ${content.displayname}`; 
            }
        } else if (membership === "join") {
            return `${targetName} joined the room`;
        } else if (membership === "invite") {
            return `${targetName} was invited to the room by ${senderName}`;
        } else if (prevMembership === "invite") {
            if (membership === "join") {
                return `${targetName} accepted the invitation to join the room`;
            } else if (membership === "leave") {
                return `${targetName} declined the invitation to join the room`;
            }
        } else if (membership === "leave") {
            if (stateKey === sender) {
                return `${targetName} left the room`;
            } else {
                const reason = content.reason;
                return `${targetName} was kicked from the room by ${senderName}${reason ? `: ${reason}` : ""}`;
            }
        } else if (membership === "ban") {
            return `${targetName} was banned from the room by ${senderName}`;
        }
        
        return `${sender} membership changed to ${content.membership}`;
    }
}

export function tests() {
    return {
        "user removes display name": (assert) => {
            const tile = new RoomMemberTile(
                {
                    prevContent: {displayname: "foo", membership: "join"},
                    content: {membership: "join"},
                    stateKey: "foo@bar.com",
                },
                {}
            );
            assert.strictEqual(tile.announcement, "foo@bar.com removed their name (foo)");
        },
        "user without display name sets a new display name": (assert) => {
            const tile = new RoomMemberTile(
                {
                    prevContent: {membership: "join"},
                    content: {displayname: "foo", membership: "join" },
                    stateKey: "foo@bar.com",
                },
                {}
            );
            assert.strictEqual(tile.announcement, "foo@bar.com changed their name to foo");
        },
    };
}
