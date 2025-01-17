/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ViewModel} from "../../ViewModel";
import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar";

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
