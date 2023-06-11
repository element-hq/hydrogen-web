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
import {RoomType} from "../../../matrix/room/common";
import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar";
import {UserTrust} from "../../../matrix/verification/CrossSigning";
import {RoomStatus} from "../../../matrix/room/common";

export class MemberDetailsViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._observableMember = options.observableMember;
        this._mediaRepository = options.mediaRepository;
        this._member = this._observableMember.get();
        this._isEncrypted = options.isEncrypted;
        this._powerLevelsObservable = options.powerLevelsObservable;
        this._session = options.session;
        this.track(this._powerLevelsObservable.subscribe(() => this._onPowerLevelsChange()));
        this.track(this._observableMember.subscribe( () => this._onMemberChange()));
        this._userTrust = undefined;
        this._userTrustSubscription = undefined;
        if (this.features.crossSigning) {
            this.track(this._session.crossSigning.subscribe(() => {
                this._onCrossSigningChange();
            }));
        }
        this._onCrossSigningChange();
    }

    get name() { return this._member.name; }
    
    get userId() { return this._member.userId; }

    get canVerifyUser() { return this._member.userId !== this._session.userId; }
    
    get trustDescription() {
        switch (this._userTrust?.get()) {
            case UserTrust.Trusted: return this.i18n`You have verified this user. This user has verified all of their sessions.`;
            case UserTrust.UserNotSigned: return this.i18n`You have not verified this user.`;
            case UserTrust.UserSignatureMismatch: return this.i18n`You appear to have signed this user, but the signature is invalid.`;
            case UserTrust.UserDeviceNotSigned: return this.i18n`You have verified this user, but they have one or more unverified sessions.`;
            case UserTrust.UserDeviceSignatureMismatch: return this.i18n`This user has a session signature that is invalid.`;
            case UserTrust.UserSetupError: return this.i18n`This user hasn't set up cross-signing correctly`;
            case UserTrust.OwnSetupError: return this.i18n`Cross-signing wasn't set up correctly on your side.`;
            case undefined:
            default: // adding default as well because jslint can't check for switch exhaustiveness
                return this.i18n`Please wait…`;
        }
    }

    get trustShieldColor() {
        if (!this._isEncrypted) {
            return "";
        }
        switch (this._userTrust?.get()) {
            case undefined:
            case UserTrust.OwnSetupError:
                return "";
            case UserTrust.Trusted:
                return "green";
            case UserTrust.UserNotSigned:
                return "black";
            default:
                return "red";
        }
    }

    get type() { return "member-details"; }
    
    get shouldShowBackButton() { return true; }
    
    get previousSegmentName() { return "members"; }
    
    get role() {
        if (this.powerLevel >= 100) { return this.i18n`Admin`; }
        else if (this.powerLevel >= 50) { return this.i18n`Moderator`; }
        else if (this.powerLevel === 0) { return this.i18n`Default`; }
        else { return this.i18n`Custom (${this.powerLevel})`; }
    }

    _onMemberChange() {
        this._member = this._observableMember.get();
        this.emitChange("member");
    }

    _onPowerLevelsChange() {
        this.emitChange("role");
    }

    async signUser() {
        const crossSigning = this._session.crossSigning.get();
        if (crossSigning) {
            await this.logger.run("MemberDetailsViewModel.signUser", async log => {
                await crossSigning.signUser(this.userId, log);
            });
        }
    }

    async verifyUser() {
        await this.logger.run("MemberDetailsViewModel.verifyUser", async () => {
            const room = this._session.findDirectMessageForUserId(this.userId);
            let roomId = room?.id;
            if (!roomId) {
                const roomBeingCreated = await this._session.createRoom({
                    type: RoomType.DirectMessage,
                    invites: [this.userId]
                });
                roomId = roomBeingCreated.roomId;
            }
            const observable = await this._session.observeRoomStatus(roomId);
            await observable.waitFor(s => s === RoomStatus.Joined).promise;
            let path = this.navigation.path.until("session");
            path = path.with(this.navigation.segment("room", roomId));
            path = path.with(this.navigation.segment("right-panel", true));
            path = path.with(this.navigation.segment("verification", this.userId));
            this.navigation.applyPath(path);
        });
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

    get powerLevel() {
        return this._powerLevelsObservable.get()?.getUserLevel(this._member.userId);
    }

    get linkToUser() {
        return `https://matrix.to/#/${encodeURIComponent(this._member.userId)}`;
    }

    async openDirectMessage() {
        const room = this._session.findDirectMessageForUserId(this.userId);
        let roomId = room?.id;
        if (!roomId) {
            const roomBeingCreated = await this._session.createRoom({
                type: RoomType.DirectMessage,
                invites: [this.userId]
            });
            roomId = roomBeingCreated.id;
        }
        this.navigation.push("room", roomId);
    }

    _onCrossSigningChange() {
        const crossSigning = this._session.crossSigning.get();
        this._userTrustSubscription = this.disposeTracked(this._userTrustSubscription);
        this._userTrust = undefined;
        if (crossSigning) {
            this.logger.run("MemberDetailsViewModel.observeUserTrust", log => {
                this._userTrust = crossSigning.observeUserTrust(this.userId, log);
                this._userTrustSubscription = this.track(this._userTrust.subscribe(() => {
                    this.emitChange("trustShieldColor");
                }));
            });
        }
        this.emitChange("trustShieldColor");
    }
}
