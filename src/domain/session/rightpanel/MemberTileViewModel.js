/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ViewModel} from "../../ViewModel";
import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar";

export class MemberTileViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._member = this._options.member;
        this._mediaRepository = options.mediaRepository
        this._previousName = null;
        this._nameChanged = true;
    }

    get name() {
        return `${this._member.name}${this._disambiguationPart}`;
    }

    get _disambiguationPart() {
        return this._disambiguate ? ` (${this.userId})` : "";
    }

    get userId() {
        return this._member.userId;
    }

    get previousName() {
        return this._previousName;
    }

    get nameChanged() {
        return this._nameChanged;
    }

    get detailsUrl() {
        const roomId = this.navigation.path.get("room").value;
        return `${this.urlRouter.openRoomActionUrl(roomId)}/member/${encodeURIComponent(this._member.userId)}`;
    }

    _updatePreviousName(newName) {
        const currentName = this._member.name;
        if (currentName !== newName) {
            this._previousName = currentName;
            this._nameChanged = true;
        } else {
            this._nameChanged = false;
        }
    }

    setDisambiguation(status) {
        this._disambiguate = status;
        this.emitChange();
    }

    updateFrom(newMember) {
        this._updatePreviousName(newMember.name);
        this._member = newMember;
    }

    get avatarLetter() {
        return avatarInitials(this.name);
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this.userId)
    }

    avatarUrl(size) {
        return getAvatarHttpUrl(this._member.avatarUrl, size, this.platform, this._mediaRepository);
    }

    get avatarTitle() {
        return this.name;
    }
}
