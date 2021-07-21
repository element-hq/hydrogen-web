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

export class MemberDetailsViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._observableMember = options.observableMember;
        this._mediaRepository = options.mediaRepository;
        this._member = this._observableMember.get();
        this._isEncrypted = options.isEncrypted;
        this._powerLevelsObservable = options.powerLevelsObservable;
        this._powerLevel = this._powerLevelFromObservable(this._powerLevelsObservable);
        this.track(this._powerLevelsObservable.subscribe(() => this._onPowerLevelsChange()));
        this.track(this._observableMember.subscribe( () => this._onMemberChange()));
    }

    get name() { return this._member.name; }
    get userId() { return this._member.userId; }

    get type() { return "member-details"; }
    
    get role() {
        if (this._powerLevel >= 100) { return "Admin"; }
        else if (this._powerLevel >= 50) { return "Moderator"; }
        else if (this._powerLevel === 0) { return "Default"; }
        else { return `Custom (${this._powerLevel})`; }
    }

    _onMemberChange() {
        this._member = this._observableMember.get();
        this.emitChange();
    }

    _onPowerLevelsChange() {
        const powerLevels = this._powerLevelsObservable.get();
        this._powerLevel = powerLevels.getUserLevel(this._member.userId);
        this.emitChange();
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

    get isEncrypted() {
        return this._isEncrypted;
    }
}
