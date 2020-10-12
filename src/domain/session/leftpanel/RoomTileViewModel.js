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

import {avatarInitials, getIdentifierColorNumber} from "../../avatar.js";
import {ViewModel} from "../../ViewModel.js";

function isSortedAsUnread(vm) {
    return vm.isUnread || (vm.isOpen && vm._wasUnreadWhenOpening);
}

export class RoomTileViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {room} = options;
        this._room = room;
        this._isOpen = false;
        this._wasUnreadWhenOpening = false;
        this._hidden = false;
        this._url = this.urlRouter.openRoomActionUrl(this._room.id);
    }

    get hidden() {
        return this._hidden;
    }

    set hidden(value) {
        if (value !== this._hidden) {
            this._hidden = value;
            this.emitChange("hidden");
        }
    }

    close() {
        if (this._isOpen) {
            this._isOpen = false;
            this.emitChange("isOpen");
        }
    }

    open() {
        if (!this._isOpen) {
            this._isOpen = true;
            this._wasUnreadWhenOpening = this._room.isUnread;
            this.emitChange("isOpen");
        }
    }

    get url() {
        return this._url;
    }

    compare(other) {
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
        if (isSortedAsUnread(this) !== isSortedAsUnread(other)) {
            if (isSortedAsUnread(this)) {
                return -1;
            }
            return 1;
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

    get isOpen() {
        return this._isOpen;
    }

    get isUnread() {
        return this._room.isUnread;
    }

    get name() {
        return this._room.name || this.i18n`Empty Room`;
    }

    // Avatar view model contract
    get avatarLetter() {
        return avatarInitials(this.name);
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this._room.id)
    }

    get avatarUrl() {
        if (this._room.avatarUrl) {
            return this._room.mediaRepository.mxcUrlThumbnail(this._room.avatarUrl, 32, 32, "crop");
        }
        return null;
    }

    get avatarTitle() {
        return this.name;
    }

    get badgeCount() {
        return this._room.notificationCount;
    }

    get isHighlighted() {
        return this._room.highlightCount !== 0;
    }
}
