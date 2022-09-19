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
import type {Options as BaseOptions} from "../../ViewModel";
import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar";
import type {MediaRepository} from "../../../matrix/net/MediaRepository";
import type {RoomMember} from "../../../matrix/room/members/RoomMember";

type Options = {
    member: RoomMember;
    emitChange: any;
    mediaRepository: MediaRepository;
} & BaseOptions;

export class MemberTileViewModel extends ViewModel {
    private _member: RoomMember;
    private _mediaRepository: MediaRepository;
    private _previousName?: string;
    private _nameChanged: boolean = true;
    private _disambiguate?: boolean;

    constructor(options: Options) {
        super(options);
        this._member = options.member;
        this._mediaRepository = options.mediaRepository;
    }

    get name(): string {
        return `${this._member.name}${this._disambiguationPart}`;
    }

    get _disambiguationPart(): string {
        return this._disambiguate ? ` (${this.userId})` : "";
    }

    get userId(): string {
        return this._member.userId;
    }

    get previousName(): string | undefined {
        return this._previousName;
    }

    get nameChanged(): boolean {
        return this._nameChanged;
    }

    get detailsUrl(): string {
        const roomId = this.navigation.path.get("room")!.value;
        return `${this.urlCreator.openRoomActionUrl(roomId)}/member/${this._member.userId}`;
    }

    _updatePreviousName(newName: string): void {
        const currentName = this._member.name;
        if (currentName !== newName) {
            this._previousName = currentName;
            this._nameChanged = true;
        } else {
            this._nameChanged = false;
        }
    }

    setDisambiguation(status: boolean): void {
        this._disambiguate = status;
        this.emitChange("TODO");
    }

    updateFrom(newMember: RoomMember): void {
        this._updatePreviousName(newMember.name);
        this._member = newMember;
    }

    get avatarLetter(): string {
        return avatarInitials(this.name);
    }

    get avatarColorNumber(): number {
        return getIdentifierColorNumber(this.userId);
    }

    avatarUrl(size: number): string | null {
        return getAvatarHttpUrl(this._member.avatarUrl, size, this.platform, this._mediaRepository);
    }

    get avatarTitle(): string {
        return this.name;
    }
}
