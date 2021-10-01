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

import {ViewModel} from "../../ViewModel.js";
import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar.js";

export class RoomDetailsViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._room = options.room;
        this._onRoomChange = this._onRoomChange.bind(this);
        this._room.on("change", this._onRoomChange);
    }

    get type() {
        return "room-details";
    }

    get shouldShowBackButton() {
        return false;
    }

    get previousSegmentName() {
        return false;
    }

    get roomId() {
        return this._room.id;
    }

    get canonicalAlias() {
        return this._room.canonicalAlias;
    }

    get name() {
        return this._room.name;
    }

    get isEncrypted() {
        return !!this._room.isEncrypted;
    }

    get memberCount() {
        return this._room.joinedMemberCount;
    }

    get avatarLetter() {
        return avatarInitials(this.name);
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this._room.avatarColorId)
    }

    avatarUrl(size) {
        return getAvatarHttpUrl(this._room.avatarUrl, size, this.platform, this._room.mediaRepository);
    }

    get avatarTitle() {
        return this.name;
    }

    _onRoomChange() {
        this.emitChange();
    }

    dispose() {
        super.dispose();
        this._room.off("change", this._onRoomChange);
    }

    openPanel(segment) {
        let path = this.navigation.path.until("room");
        path = path.with(this.navigation.segment("right-panel", true));
        path = path.with(this.navigation.segment(segment, true));
        this.navigation.applyPath(path);
    }
}
