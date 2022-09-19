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
import type {SegmentType} from "../../navigation";
import type {Room} from "../../../matrix/room/Room";
import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar";

export type ExplicitOptions = { room: Room };

type Options = ExplicitOptions & BaseOptions;

export class RoomDetailsViewModel extends ViewModel {
    private _room: Room

    constructor(options: Options) {
        super(options);
        this._room = options.room;
        this._onRoomChange = this._onRoomChange.bind(this);
        this._room.on("change", this._onRoomChange);
    }

    get type(): string {
        return "room-details";
    }

    get shouldShowBackButton(): boolean {
        return false;
    }

    get previousSegmentName(): boolean {
        return false;
    }

    get roomId(): string {
        return this._room.id;
    }

    get canonicalAlias(): string | undefined {
        return this._room.canonicalAlias;
    }

    get name(): string {
        return this._room.name;
    }

    get isEncrypted(): boolean {
        return !!this._room.isEncrypted;
    }

    get memberCount(): number {
        return this._room.joinedMemberCount;
    }

    get avatarLetter(): string {
        return avatarInitials(this.name);
    }

    get avatarColorNumber(): number {
        return getIdentifierColorNumber(this._room.avatarColorId);
    }

    avatarUrl(size): string | null {
        return getAvatarHttpUrl(this._room.avatarUrl, size, this.platform, this._room.mediaRepository);
    }

    get avatarTitle(): string {
        return this.name;
    }

    _onRoomChange(): void {
        this.emitChange("TODO");
    }

    dispose(): void {
        super.dispose();
        this._room.off("change", this._onRoomChange);
    }

    openPanel(segment: keyof SegmentType): void {
        let path = this.navigation.path.until("room");
        path = path.with(this.navigation.segment("right-panel", true))!;
        path = path.with(this.navigation.segment(segment, true))!;
        this.navigation.applyPath(path);
    }
}
