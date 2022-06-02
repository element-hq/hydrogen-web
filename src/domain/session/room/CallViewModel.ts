/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import {AvatarSource} from "../../AvatarSource";
import {ViewModel, Options as BaseOptions} from "../../ViewModel";
import {getStreamVideoTrack, getStreamAudioTrack} from "../../../matrix/calls/common";
import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar";
import {EventObservableValue} from "../../../observable/value/EventObservableValue";
import {ObservableValueMap} from "../../../observable/map/ObservableValueMap";
import type {GroupCall} from "../../../matrix/calls/group/GroupCall";
import type {Member} from "../../../matrix/calls/group/Member";
import type {BaseObservableList} from "../../../observable/list/BaseObservableList";
import type {Stream} from "../../../platform/types/MediaDevices";
import type {MediaRepository} from "../../../matrix/net/MediaRepository";

type Options = BaseOptions & {
    call: GroupCall,
    mediaRepository: MediaRepository
};

export class CallViewModel extends ViewModel<Options> {
    public readonly memberViewModels: BaseObservableList<IStreamViewModel>;

    constructor(options: Options) {
        super(options);
        const ownMemberViewModelMap = new ObservableValueMap("self", new EventObservableValue(this.call, "change"))
            .mapValues(call => new OwnMemberViewModel(this.childOptions({call: this.call, mediaRepository: this.getOption("mediaRepository")})), () => {});
        this.memberViewModels = this.call.members
            .filterValues(member => member.isConnected)
            .mapValues(member => new CallMemberViewModel(this.childOptions({member, mediaRepository: this.getOption("mediaRepository")})))
            .join(ownMemberViewModelMap)
            .sortValues((a, b) => a.compare(b));
    }

    private get call(): GroupCall {
        return this.getOption("call");
    }

    get name(): string {
        return this.call.name;
    }

    get id(): string {
        return this.call.id;
    }

    get stream(): Stream | undefined {
        return this.call.localMedia?.userMedia;
    }

    leave() {
        if (this.call.hasJoined) {
            this.call.leave();
        }
    }

    async toggleVideo() {
        if (this.call.muteSettings) {
            this.call.setMuted(this.call.muteSettings.toggleCamera());
        }
    }
}

type OwnMemberOptions = BaseOptions & {
    call: GroupCall,
    mediaRepository: MediaRepository
}

class OwnMemberViewModel extends ViewModel<OwnMemberOptions> implements IStreamViewModel {
    get stream(): Stream | undefined {
        return this.call.localMedia?.userMedia;
    }

    private get call(): GroupCall {
        return this.getOption("call");
    }

    get isCameraMuted(): boolean {
        return isMuted(this.call.muteSettings?.camera, !!getStreamVideoTrack(this.stream));
    }

    get isMicrophoneMuted(): boolean {
        return isMuted(this.call.muteSettings?.microphone, !!getStreamAudioTrack(this.stream));
    }

    get avatarLetter(): string {
        return "I";
    }

    get avatarColorNumber(): number {
        return 3;
    }

    avatarUrl(size: number): string | undefined {
        return undefined;
    }

    get avatarTitle(): string {
        return "Me";
    }

    compare(other: OwnMemberViewModel | CallMemberViewModel): number {
        return -1;
    }
}

type MemberOptions = BaseOptions & {
    member: Member,
    mediaRepository: MediaRepository
};

export class CallMemberViewModel extends ViewModel<MemberOptions> implements IStreamViewModel {
    get stream(): Stream | undefined {
        return this.member.remoteMedia?.userMedia;
    }

    private get member(): Member {
        return this.getOption("member");
    }

    get isCameraMuted(): boolean {
        return isMuted(this.member.remoteMuteSettings?.camera, !!getStreamVideoTrack(this.stream));
    }

    get isMicrophoneMuted(): boolean {
        return isMuted(this.member.remoteMuteSettings?.microphone, !!getStreamAudioTrack(this.stream));
    }

    get avatarLetter(): string {
        return avatarInitials(this.member.member.name);
    }

    get avatarColorNumber(): number {
        return getIdentifierColorNumber(this.member.userId);
    }

    avatarUrl(size: number): string | undefined {
        const {avatarUrl} = this.member.member;
        const mediaRepository = this.getOption("mediaRepository");
        return getAvatarHttpUrl(avatarUrl, size, this.platform, mediaRepository);
    }

    get avatarTitle(): string {
        return this.member.member.name;
    }

    compare(other: OwnMemberViewModel | CallMemberViewModel): number {
        if (other instanceof OwnMemberViewModel) {
            return -other.compare(this);
        }
        const myUserId = this.member.member.userId;
        const otherUserId = other.member.member.userId;
        if(myUserId === otherUserId) {
            return 0;
        }
        return myUserId < otherUserId ? -1 : 1;
    }
}

export interface IStreamViewModel extends AvatarSource, ViewModel {
    get stream(): Stream | undefined;
    get isCameraMuted(): boolean;
    get isMicrophoneMuted(): boolean;
}

function isMuted(muted: boolean | undefined, hasTrack: boolean) {
    if (muted) {
        return true;
    } else {
        return !hasTrack;
    }
}
