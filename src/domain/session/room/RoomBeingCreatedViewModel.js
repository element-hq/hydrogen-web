/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

