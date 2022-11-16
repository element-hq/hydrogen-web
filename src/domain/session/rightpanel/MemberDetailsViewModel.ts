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
import {RoomType} from "../../../matrix/room/common";
import type {Options as BaseOptions} from "../../ViewModel";
import type {RetainedObservableValue} from "../../../observable/ObservableValue";
import type { MediaRepository } from "../../../matrix/net/MediaRepository";
import type {Session} from "../../../matrix/Session";
import type {RoomMember} from "../../../matrix/room/members/RoomMember";
import type {PowerLevels} from "../../../matrix/room/PowerLevels";

export type ExplicitOptions = {
    observableMember: RetainedObservableValue<RoomMember>,
    mediaRepository: MediaRepository,
    isEncrypted: boolean,
    powerLevelsObservable: RetainedObservableValue<PowerLevels>,
    session: Session
};

type Options = BaseOptions & ExplicitOptions;

export class MemberDetailsViewModel extends ViewModel {
    private _observableMember: RetainedObservableValue<RoomMember>;
    private _mediaRepository: MediaRepository;
    private _member: RoomMember;
    private _isEncrypted: boolean;
    private _powerLevelsObservable: RetainedObservableValue<PowerLevels>;
    private _session: Session;

    constructor(options: Options) {
        super(options);
        this._observableMember = options.observableMember;
        this._mediaRepository = options.mediaRepository;
        this._member = this._observableMember.get();
        this._isEncrypted = options.isEncrypted;
        this._powerLevelsObservable = options.powerLevelsObservable;
        this._session = options.session;
        this.track(this._powerLevelsObservable.subscribe(() => this._onPowerLevelsChange()));
        this.track(this._observableMember.subscribe( () => this._onMemberChange()));
    }

    get name(): string { return this._member.name; }
    get userId(): string { return this._member.userId; }

    get type(): string { return "member-details"; }
    get shouldShowBackButton(): boolean { return true; }
    get previousSegmentName(): string { return "members"; }

    get role(): string {
        if (this.powerLevel >= 100) { return this.i18n`Admin`; }
        else if (this.powerLevel >= 50) { return this.i18n`Moderator`; }
        else if (this.powerLevel === 0) { return this.i18n`Default`; }
        else { return this.i18n`Custom (${this.powerLevel})`; }
    }

    _onMemberChange(): void {
        this._member = this._observableMember.get();
        this.emitChange("member");
    }

    _onPowerLevelsChange(): void {
        this.emitChange("role");
    }

    get avatarLetter(): string {
        return avatarInitials(this.name);
    }

    get avatarColorNumber(): number {
        return getIdentifierColorNumber(this.userId);
    }

    avatarUrl(size): string | null {
        return getAvatarHttpUrl(this._member.avatarUrl, size, this.platform, this._mediaRepository);
    }

    get avatarTitle(): string{
        return this.name;
    }

    get isEncrypted(): boolean {
        return this._isEncrypted;
    }

    get powerLevel(): number {
        return this._powerLevelsObservable.get()?.getUserLevel(this._member.userId);
    }

    get linkToUser(): string {
        return `https://matrix.to/#/${encodeURIComponent(this._member.userId)}`;
    }

    async openDirectMessage(): Promise<void> {
        const room = this._session.findDirectMessageForUserId(this.userId);
        let roomId = room?.id;
        if (!roomId) {
            const roomBeingCreated = await this._session.createRoom({
                type: RoomType.DirectMessage,
                invites: [this.userId],
                loadProfiles: false,
            });
            roomId = roomBeingCreated.id;
        }
        this.navigation.push("room", roomId);
    }
}
