/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import type {GroupCall} from "../../../matrix/calls/group/GroupCall";
import type {Room} from "../../../matrix/room/Room.js";
import {IAvatarContract, avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar"; 
import {LocalMedia} from "../../../matrix/calls/LocalMedia";
import {BaseClassOptions, BaseToastNotificationViewModel} from "./BaseToastNotificationViewModel";

type Options = {
    call: GroupCall;
    room: Room;
} & BaseClassOptions;


export class CallToastNotificationViewModel extends BaseToastNotificationViewModel<Options> implements IAvatarContract {
    constructor(options: Options) {
        super(options);
        this.track(
            this.call.members.subscribe({
                onAdd: (_, __) => {
                    this.emitChange("memberCount");
                },
                onUpdate: (_, __) => {
                    this.emitChange("memberCount");
                },
                onRemove: (_, __) => {
                    this.emitChange("memberCount");
                },
                onReset: () => {
                    this.emitChange("memberCount");
                },
            })
        );
        // Dismiss the toast if the room is opened manually
        this.track(
            this.navigation.observe("room").subscribe(roomId => {
                if (roomId === this.call.roomId) {
                    this.dismiss();
                }
        }));
    }

    async join(): Promise<void> {
        await this.logAndCatch("CallToastNotificationViewModel.join", async (log) => {
            const stream = await this.platform.mediaDevices.getMediaTracks(false, true);
            const localMedia = new LocalMedia().withUserMedia(stream);
            await this.call.join(localMedia, log);
            const url = this.urlCreator.openRoomActionUrl(this.call.roomId);
            this.urlCreator.pushUrl(url);
        });
    }

    get call(): GroupCall {
        return this.getOption("call");
    }

    private get room(): Room {
        return this.getOption("room");
    } 

    get roomName(): string {
        return this.room.name;
    }

    get memberCount(): number {
        return this.call.members.size;
    }

    get avatarLetter(): string {
        return avatarInitials(this.roomName);
    }

    get avatarColorNumber(): number {
        return getIdentifierColorNumber(this.room.avatarColorId);
    }

    avatarUrl(size: number): string | undefined {
        return getAvatarHttpUrl(this.room.avatarUrl, size, this.platform, this.room.mediaRepository);
    }

    get avatarTitle(): string {
        return this.roomName;
    }
}


