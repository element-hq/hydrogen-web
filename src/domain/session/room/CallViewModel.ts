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
import type {Room} from "../../../matrix/room/Room";
import type {GroupCall} from "../../../matrix/calls/group/GroupCall";
import type {Member} from "../../../matrix/calls/group/Member";
import type {RoomMember} from "../../../matrix/room/members/RoomMember";
import type {BaseObservableList} from "../../../observable/list/BaseObservableList";
import type {BaseObservableValue} from "../../../observable/value/BaseObservableValue";
import type {Stream} from "../../../platform/types/MediaDevices";
import type {MediaRepository} from "../../../matrix/net/MediaRepository";

type Options = BaseOptions & {
    call: GroupCall,
    room: Room,
};

export class CallViewModel extends ViewModel<Options> {
    public readonly memberViewModels: BaseObservableList<IStreamViewModel>;

    constructor(options: Options) {
        super(options);
        const ownMemberViewModelMap = new ObservableValueMap("self", new EventObservableValue(this.call, "change"))
            .mapValues((call, emitChange) => new OwnMemberViewModel(this.childOptions({call, emitChange})), () => {});
        this.memberViewModels = this.call.members
            .filterValues(member => member.isConnected)
            .mapValues(member => new CallMemberViewModel(this.childOptions({member, mediaRepository: this.getOption("room").mediaRepository})))
            .join(ownMemberViewModelMap)
            .sortValues((a, b) => a.compare(b));
        this.track(this.memberViewModels.subscribe({
            onRemove: () => {
                this.emitChange(); // update memberCount
            },
            onAdd: () => {
                this.emitChange(); // update memberCount
            },
            onUpdate: () => {},
            onReset: () => {},
            onMove: () => {}
        }))
    }

    get isCameraMuted(): boolean {
        return this.call.muteSettings?.camera ?? true;
    }

    get isMicrophoneMuted(): boolean {
        return this.call.muteSettings?.microphone ?? true;
    }

    get memberCount(): number {
        return this.memberViewModels.length;
    }

    get name(): string {
        return this.call.name;
    }

    get id(): string {
        return this.call.id;
    }

    private get call(): GroupCall {
        return this.getOption("call");
    }

    async hangup() {
        if (this.call.hasJoined) {
            await this.call.leave();
        }
    }

    async toggleCamera() {
        const {localMedia, muteSettings} = this.call;
        if (muteSettings && localMedia) {
            // unmute but no track?
            if (muteSettings.camera && !getStreamVideoTrack(localMedia.userMedia)) {
                const stream = await this.platform.mediaDevices.getMediaTracks(!muteSettings.microphone, true);
                await this.call.setMedia(localMedia.withUserMedia(stream));
            } else {
                await this.call.setMuted(muteSettings.toggleCamera());
            }
            this.emitChange();
        }
    }

    async toggleMicrophone() {
        const {localMedia, muteSettings} = this.call;
        if (muteSettings && localMedia) {
            // unmute but no track?
            if (muteSettings.microphone && !getStreamAudioTrack(localMedia.userMedia)) {
                const stream = await this.platform.mediaDevices.getMediaTracks(true, !muteSettings.camera);
                console.log("got tracks", Array.from(stream.getTracks()).map((t: MediaStreamTrack) => { return {kind: t.kind, id: t.id};}))
                await this.call.setMedia(localMedia.withUserMedia(stream));
            } else {
                await this.call.setMuted(muteSettings.toggleMicrophone());
            }
            this.emitChange();
        }
    }
}

class OwnMemberViewModel extends ViewModel<Options> implements IStreamViewModel {
    private memberObservable: undefined | BaseObservableValue<RoomMember>;
    
    constructor(options: Options) {
        super(options);
        this.init();
    }

    async init() {
        const room = this.getOption("room");
        this.memberObservable = await room.observeMember(room.user.id);
        this.track(this.memberObservable!.subscribe(() => {
            this.emitChange(undefined);
        }));
    }

    get stream(): Stream | undefined {
        return this.call.localMedia?.userMediaPreview;
    }

    private get call(): GroupCall {
        return this.getOption("call");
    }

    get isCameraMuted(): boolean {
        return this.call.muteSettings?.camera ?? true;
    }

    get isMicrophoneMuted(): boolean {
        return this.call.muteSettings?.microphone ?? true;
    }

    get avatarLetter(): string {
        const member = this.memberObservable?.get();
        if (member) {
            return avatarInitials(member.name);
        } else {
            return this.getOption("room").user.id;
        }
    }

    get avatarColorNumber(): number {
        return getIdentifierColorNumber(this.getOption("room").user.id);
    }

    avatarUrl(size: number): string | undefined {
        const member = this.memberObservable?.get();
        if (member) {
            return getAvatarHttpUrl(member.avatarUrl, size, this.platform, this.getOption("room").mediaRepository);
        }
    }

    get avatarTitle(): string {
        const member = this.memberObservable?.get();
        if (member) {
            return member.name;
        } else {
            return this.getOption("room").user.id;
        }
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
        return this.member.remoteMuteSettings?.camera ?? true;
    }

    get isMicrophoneMuted(): boolean {
        return this.member.remoteMuteSettings?.microphone ?? true;
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
