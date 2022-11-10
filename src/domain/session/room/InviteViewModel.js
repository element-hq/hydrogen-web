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

export class InviteViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {invite, mediaRepository} = options;
        this._invite = invite;
        this._mediaRepository = mediaRepository;
        this._onInviteChange = this._onInviteChange.bind(this);
        this._error = null;
        this._closeUrl = this.urlRouter.urlUntilSegment("session");
        this._invite.on("change", this._onInviteChange);
        this._inviter = null;
        if (this._invite.inviter) {
            this._inviter = new RoomMemberViewModel(this._invite.inviter, mediaRepository, this.platform);
        }
        this._roomDescription = this._createRoomDescription();
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
        return getIdentifierColorNumber(this._invite.avatarColorId)
    }

    avatarUrl(size) {
        return getAvatarHttpUrl(this._invite.avatarUrl, size, this.platform, this._mediaRepository);
    }

    _createRoomDescription() {
        const parts = [];
        if (this._invite.isPublic) {
            parts.push("Public room");
        } else {
            parts.push("Private room");
        }

        if (this._invite.canonicalAlias) {
            parts.push(this._invite.canonicalAlias);
        }
        return parts.join(" • ")
    }

    get roomDescription() {
        return this._roomDescription;
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
        this.emitChange();
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

    get id() {
        return this._member.userId;
    }

    get name() {
        return this._member.name;
    }

    get avatarLetter() {
        return avatarInitials(this.name);
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this._member.userId);
    }

    avatarUrl(size) {
        return getAvatarHttpUrl(this._member.avatarUrl, size, this._platform, this._mediaRepository);
    }

    get avatarTitle() {
        return this.name;
    }
}
