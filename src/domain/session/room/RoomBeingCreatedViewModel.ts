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

import {IGridItemViewModel} from './IGridItemViewModel';
import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar";
import {ViewModel} from "../../ViewModel";
import type {Options as ViewModelOptions} from "../../ViewModel";
import type {RoomBeingCreated} from "../../../matrix/room/RoomBeingCreated";
import type {MediaRepository} from "../../../matrix/net/MediaRepository";

type Options = ViewModelOptions & {
    roomBeingCreated: RoomBeingCreated,
    mediaRepository: MediaRepository
}

export class RoomBeingCreatedViewModel extends ViewModel implements IGridItemViewModel {
    private _roomBeingCreated: RoomBeingCreated;
    private _mediaRepository: MediaRepository;
    private _closeUrl: string;

    constructor(options: Options) {
        super(options);
        const {roomBeingCreated, mediaRepository} = options;
        this._roomBeingCreated = roomBeingCreated;
        this._mediaRepository = mediaRepository;
        this._onRoomChange = this._onRoomChange.bind(this);
        this._closeUrl = this.urlCreator.urlUntilSegment("session");
        this._roomBeingCreated.on("change", this._onRoomChange);
    }

    get kind(): string { return "roomBeingCreated"; }
    get closeUrl(): string { return this._closeUrl; }
    get name(): string { return this._roomBeingCreated.name; }
    get id(): string { return this._roomBeingCreated.id; }
    get isEncrypted(): boolean { return this._roomBeingCreated.isEncrypted; }
    get error(): string {
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
    get avatarLetter(): string { return avatarInitials(this.name); }
    get avatarColorNumber(): number { return getIdentifierColorNumber(this._roomBeingCreated.avatarColorId); }
    get avatarTitle(): string { return this.name; }

    avatarUrl(size: number): string | null {
        // allow blob url which doesn't need mxc => http resolution
        return this._roomBeingCreated.avatarBlobUrl ??
            getAvatarHttpUrl(this._roomBeingCreated.avatarUrl!, size, this.platform, this._mediaRepository);
    }

    focus(): void {}

    _onRoomChange(): void {
        this.emitChange("roomBeingCreated");
    }

    cancel(): void {
        this._roomBeingCreated.cancel();
        // navigate away from the room
        this.navigation.applyPath(this.navigation.path.until("session"));
    }

    dispose(): void {
        super.dispose();
        this._roomBeingCreated.off("change", this._onRoomChange);
    }
}

