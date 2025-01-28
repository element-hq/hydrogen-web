/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import type {GroupCall} from "../../../../matrix/calls/group/GroupCall";
import type {Room} from "../../../../matrix/room/Room.js";
import {IAvatarContract, avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../../avatar"; 
import {LocalMedia} from "../../../../matrix/calls/LocalMedia";
import {BaseClassOptions, BaseToastNotificationViewModel} from ".././BaseToastNotificationViewModel";
import {SegmentType} from "../../../navigation";

type Options<N extends MinimumNeededSegmentType = SegmentType> = {
    call: GroupCall;
    room: Room;
} & BaseClassOptions<N>;

// Since we access the room segment below, the segment type
// needs to at least contain the room segment!
type MinimumNeededSegmentType = {
    "room": string;
};

export class CallToastNotificationViewModel<N extends MinimumNeededSegmentType = SegmentType, O extends Options<N> = Options<N>> extends BaseToastNotificationViewModel<N, O> implements IAvatarContract {
    constructor(options: O) {
        super(options);
        this.track(this.call.members.observeSize().subscribe(() => {
            this.emitChange("memberCount");
        }));
        // Dismiss the toast if the room is opened manually
        this.track(
            this.navigation.observe("room").subscribe((roomId) => {
                if ((roomId as unknown as string) === this.call.roomId) {
                    this.dismiss();
                }
        }));
    }

    get kind(): "calls" {
        return "calls";
    }

    async join(): Promise<void> {
        await this.logAndCatch("CallToastNotificationViewModel.join", async (log) => {
            const stream = await this.platform.mediaDevices.getMediaTracks(false, true);
            const localMedia = new LocalMedia().withUserMedia(stream);
            await this.call.join(localMedia, log);
            const url = this.urlRouter.openRoomActionUrl(this.call.roomId);
            this.urlRouter.pushUrl(url);
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


