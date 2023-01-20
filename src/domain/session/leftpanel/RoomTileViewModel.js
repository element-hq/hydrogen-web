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

import {BaseTileViewModel} from "./BaseTileViewModel.js";

export class RoomTileViewModel extends BaseTileViewModel {
    constructor(options) {
        super(options);
        const {room} = options;
        this._room = room;
        this._url = this.urlRouter.openRoomActionUrl(this._room.id);
    }

    get kind() {
        return "room";
    }

    get url() {
        return this._url;
    }

    /** very important that sorting order is stable and that comparing
     * to itself always returns 0, otherwise SortedMapList will
     * remove the wrong children, etc ... */
    compare(other) {
        const parentComparison = super.compare(other);
        if (parentComparison !== 0) {
            return parentComparison;
        }
        /*
        put unread rooms first
        then put rooms with a timestamp first, and sort by name
        then sort by name for rooms without a timestamp
         */
        const myRoom = this._room;
        const theirRoom = other._room;

        if (myRoom.isLowPriority !== theirRoom.isLowPriority) {
            if (myRoom.isLowPriority) {
                return 1;
            }
            return -1;
        }
        const myTimestamp = myRoom.lastMessageTimestamp;
        const theirTimestamp = theirRoom.lastMessageTimestamp;
        const myTimestampValid = Number.isSafeInteger(myTimestamp);
        const theirTimestampValid = Number.isSafeInteger(theirTimestamp);
        // if either does not have a timestamp, put the one with a timestamp first
        if (myTimestampValid !== theirTimestampValid) {
            if (!theirTimestampValid) {
                return -1;
            }
            return 1;
        }
        const timeDiff = theirTimestamp - myTimestamp;
        if (timeDiff === 0 || !theirTimestampValid || !myTimestampValid) {
            // sort alphabetically
            const nameCmp = this.name.localeCompare(other.name);
            if (nameCmp === 0) {
                return this._room.id.localeCompare(other._room.id);
            }
            return nameCmp;
        }
        return timeDiff;
    }

    get isUnread() {
        return this._room.isUnread;
    }

    get name() {
        return this._room.name || this.i18n`Empty Room`;
    }

    get badgeCount() {
        return this._room.notificationCount;
    }

    get isHighlighted() {
        return this._room.highlightCount !== 0;
    }

    get _avatarSource() {
        return this._room;
    }
}
