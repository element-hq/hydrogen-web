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
