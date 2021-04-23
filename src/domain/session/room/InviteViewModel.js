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

import {avatarInitials, getIdentifierColorNumber} from "../../avatar.js";
import {ViewModel} from "../../ViewModel.js";

export class InviteViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {invite, mediaRepository, refreshRoomViewModel} = options;
        this._invite = invite;
        this._mediaRepository = mediaRepository;
        this._refreshRoomViewModel = refreshRoomViewModel;
        this._onInviteChange = this._onInviteChange.bind(this);
        this._error = null;
        this._closeUrl = this.urlCreator.urlUntilSegment("session");
        this._invite.on("change", this._onInviteChange);
        this._inviter = null;
        if (this._invite.inviter && ! this._invite.isDirectMessage) {
            this._inviter = new RoomMemberViewModel(this._invite.inviter, mediaRepository, this.platform);
        }
    }

    get kind() { return "invite"; }
    get closeUrl() { return this._closeUrl; }
    get name() { return this._invite.name; }
    get id() { return this._invite.id; }
    get isEncrypted() { return this._invite.isEncrypted; }
    get isDirectMessage() { return this._invite.isDirectMessage; }
    get inviter() { return this._inviter; }
    get busy() { return this._invite.accepting || this._invite.rejecting; }

    get error() {
        if (this._error) {
            return `Something went wrong: ${this._error.message}`;
        }
        return "";
    }

    get avatarLetter() {
        return avatarInitials(this.name);
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this._invite.id)
    }

    get avatarUrl() {
        if (this._invite.avatarUrl) {
            const size = 32 * this.platform.devicePixelRatio;
            return this._mediaRepository.mxcUrlThumbnail(this._invite.avatarUrl, size, size, "crop");
        }
        return null;
    }

    get avatarTitle() {
        return this.name;
    }

    focus() {}

    async accept() {
        try {
            await this._invite.accept();
        } catch (err) {
            this._error = err;
            this.emitChange("error");
        }
    }

    async reject() {
        try {
            await this._invite.reject();
        } catch (err) {
            this._error = err;
            this.emitChange("error");
        }
    }

    _onInviteChange() {
        if (this._invite.accepted || this._invite.rejected) {
            // close invite if rejected, or open room if accepted.
            // Done with a callback rather than manipulating the nav,
            // as closing the invite changes the nav path depending whether
            // we're in a grid view, and opening the room doesn't change
            // the nav path because the url is the same for an
            // invite and the room.
            this._refreshRoomViewModel(this.id);
        } else {
            this.emitChange();
        }
    }

    dispose() {
        super.dispose();
        this._invite.off("change", this._onInviteChange);
    }
}

class RoomMemberViewModel {
    constructor(member, mediaRepository, platform) {
        this._member = member;
        this._mediaRepository = mediaRepository;
        this._platform = platform;
    }

    get name() {
        return this._member.name;
    }

    get avatarLetter() {
        return avatarInitials(this.name);
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this._member.userId)
    }

    get avatarUrl() {
        if (this._member.avatarUrl) {
            const size = 32 * this.platform.devicePixelRatio;
            return this._mediaRepository.mxcUrlThumbnail(this._member.avatarUrl, size, size, "crop");
        }
        return null;
    }

    get avatarTitle() {
        return this.name;
    }
}
