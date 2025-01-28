/*
Copyright 2025 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar";
import {ViewModel} from "../../ViewModel";

export class RoomBeingCreatedViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {roomBeingCreated, mediaRepository} = options;
        this._roomBeingCreated = roomBeingCreated;
        this._mediaRepository = mediaRepository;
        this._onRoomChange = this._onRoomChange.bind(this);
        this._closeUrl = this.urlRouter.urlUntilSegment("session");
        this._roomBeingCreated.on("change", this._onRoomChange);
    }

    get kind() { return "roomBeingCreated"; }
    get closeUrl() { return this._closeUrl; }
    get name() { return this._roomBeingCreated.name; }
    get id() { return this._roomBeingCreated.id; }
    get isEncrypted() { return this._roomBeingCreated.isEncrypted; }
    get error() {
        const {error} = this._roomBeingCreated;
        if (error) {
            if (error.name === "ConnectionError") {
                return this.i18n`You seem to be offline`;
            } else {
                return error.message;
            }
        }
        return "";
    }
    get avatarLetter() { return avatarInitials(this.name); }
    get avatarColorNumber() { return getIdentifierColorNumber(this._roomBeingCreated.avatarColorId); }
    get avatarTitle() { return this.name; }

    avatarUrl(size) {
        // allow blob url which doesn't need mxc => http resolution
        return this._roomBeingCreated.avatarBlobUrl ??
            getAvatarHttpUrl(this._roomBeingCreated.avatarUrl, size, this.platform, this._mediaRepository);
    }

    focus() {}

    _onRoomChange() {
        this.emitChange();
    }

    cancel() {
        this._roomBeingCreated.cancel();
        // navigate away from the room
        this.navigation.applyPath(this.navigation.path.until("session"));
    }

    dispose() {
        super.dispose();
        this._roomBeingCreated.off("change", this._onRoomChange);
    }
}

