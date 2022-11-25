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
