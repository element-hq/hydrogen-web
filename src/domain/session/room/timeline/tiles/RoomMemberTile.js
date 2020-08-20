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

import {SimpleTile} from "./SimpleTile.js";

export class RoomMemberTile extends SimpleTile {

    get shape() {
        return "announcement";
    }

    get announcement() {
        const {sender, content, prevContent} = this._entry;
        const name = this._entry.displayName || sender;
        const membership = content && content.membership;
        const prevMembership = prevContent && prevContent.membership;

        if (prevMembership === "join" && membership === "join") {
            if (content.avatar_url !== prevContent.avatar_url) {
                return `${name} changed their avatar`; 
            } else if (content.displayname !== prevContent.displayname) {
                return `${name} changed their name to ${content.displayname}`; 
            }
        } else if (membership === "join") {
            return `${name} joined the room`;
        } else if (membership === "invite") {
            return `${name} was invited to the room by ${sender}`;
        } else if (prevMembership === "invite") {
            if (membership === "join") {
                return `${name} accepted the invitation to join the room`;
            } else if (membership === "leave") {
                return `${name} declined the invitation to join the room`;
            }
        } else if (membership === "leave") {
            if (name === sender) {
                return `${name} left the room`;
            } else {
                const reason = content.reason;
                return `${name} was kicked from the room by ${sender}${reason ? `: ${reason}` : ""}`;
            }
        } else if (membership === "ban") {
            return `${name} was banned from the room by ${sender}`;
        }
        
        return `${sender} membership changed to ${content.membership}`;
    }
}
