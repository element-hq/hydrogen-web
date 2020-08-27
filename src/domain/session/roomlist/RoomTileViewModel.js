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

import {avatarInitials, getIdentifierColorNumber} from "../../avatar.js";
import {ViewModel} from "../../ViewModel.js";

function isSortedAsUnread(vm) {
    return vm.isUnread || (vm.isOpen && vm._wasUnreadWhenOpening);
}

export class RoomTileViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {room, emitOpen} = options;
        this._room = room;
        this._emitOpen = emitOpen;
        this._isOpen = false;
        this._wasUnreadWhenOpening = false;
    }

    // called by parent for now (later should integrate with router)
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
            this._emitOpen(this._room, this);
        }
    }

    compare(other) {
        /*
        put unread rooms first
        then put rooms with a timestamp first, and sort by name
        then sort by name for rooms without a timestamp
         */
        const myRoom = this._room;
        const theirRoom = other._room;

        let buf = "";
        function log(...args) {
            buf = buf + args.map(a => a+"").join(" ") + "\n";
        }
        function logResult(result) {
            if (result === 0) {
                log("rooms are equal (should not happen)", result);
            } else if (result > 0) {
                log(`${theirRoom.name || theirRoom.id} comes first`, result);
            } else {
                log(`${myRoom.name || myRoom.id} comes first`, result);
            }
            console.info(buf);
            return result;
        }
        log(`comparing ${myRoom.name || theirRoom.id} and ${theirRoom.name || theirRoom.id} ...`);
        log("comparing isUnread...");
        if (isSortedAsUnread(this) !== isSortedAsUnread(other)) {
            if (isSortedAsUnread(this)) {
                return logResult(-1);
            }
            return logResult(1);
        }
        const myTimestamp = myRoom.lastMessageTimestamp;
        const theirTimestamp = theirRoom.lastMessageTimestamp;
        const myTimestampValid = Number.isSafeInteger(myTimestamp);
        const theirTimestampValid = Number.isSafeInteger(theirTimestamp);
        // if either does not have a timestamp, put the one with a timestamp first
        if (myTimestampValid !== theirTimestampValid) {
            log("checking if either does not have lastMessageTimestamp ...", myTimestamp, theirTimestamp);
            if (!theirTimestampValid) {
                return logResult(-1);
            }
            return logResult(1);
        }
        const timeDiff = theirTimestamp - myTimestamp;
        if (timeDiff === 0 || !theirTimestampValid || !myTimestampValid) {
            log("checking name ...", myTimestamp, theirTimestamp);
            // sort alphabetically
            const nameCmp = this.name.localeCompare(other.name);
            if (nameCmp === 0) {
                return logResult(this._room.id.localeCompare(other._room.id));
            }
            return logResult(nameCmp);
        }
        log("checking timestamp ...");
        return logResult(timeDiff);
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
