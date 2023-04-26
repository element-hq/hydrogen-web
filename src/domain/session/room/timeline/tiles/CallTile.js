/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {SimpleTile} from "./SimpleTile.js";
import {ViewModel} from "../../../../ViewModel";
import {LocalMedia} from "../../../../../matrix/calls/LocalMedia";
import {CallType} from "../../../../../matrix/calls/callEventTypes";
import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../../../avatar";

// TODO: timeline entries for state events with the same state key and type
// should also update previous entries in the timeline, so we can update the name of the call, whether it is terminated, etc ...

// alternatively, we could just subscribe to the GroupCall and spontanously emit an update when it updates

export class CallTile extends SimpleTile {
    constructor(entry, options) {
        super(entry, options);
        const calls = this.getOption("session").callHandler.calls;
        this._callSubscription = undefined;
        this._memberSizeSubscription = undefined;
        const call = calls.get(this._entry.stateKey);
        if (call && !call.isTerminated) {
            this._call = call;
            this.memberViewModels = this._setupMembersList(this._call);
            this._callSubscription = this.track(this._call.disposableOn("change", () => {
                this._onCallUpdate();
            }));
            this._memberSizeSubscription = this.track(this._call.members.observeSize().subscribe(() => {
                this.emitChange("memberCount");
            }));
            this._onCallUpdate();
        }
    }

    _onCallUpdate() {
        // unsubscribe when terminated
        if (this._call.isTerminated) {
            this._durationInterval = this.disposeTracked(this._durationInterval);
            this._callSubscription = this.disposeTracked(this._callSubscription);
            this._call = undefined;
        } else if (!this._durationInterval) {
            this._durationInterval = this.track(this.platform.clock.createInterval(() => {
                this.emitChange("duration");
            }, 1000));
        }
        this.emitChange();
    }

    _setupMembersList(call) {
        return call.members.mapValues(
            (member, emitChange) => new MemberAvatarViewModel(this.childOptions({
                member,
                emitChange,
                mediaRepository: this.getOption("room").mediaRepository
            })),
        ).sortValues((a, b) => a.userId.localeCompare(b.userId));
    }

    get memberCount() {
        // TODO: emit updates for this property
        if (this._call) {
            return this._call.members.size;
        }
        return 0;
    }

    get confId() {
        return this._entry.stateKey;
    }

    get duration() {
        if (this._call && this._call.duration) {
            return this.timeFormatter.formatDuration(this._call.duration);
        } else {
            return "";
        }
    }
    
    get shape() {
        return "call";
    }

    get canJoin() {
        return this._call && !this._call.hasJoined && !this._call.usesFoci;
    }

    get canLeave() {
        return this._call && this._call.hasJoined;
    }

    get title() {
        if (this._call) {
            if (this.type === CallType.Video) {
                return `${this.displayName} started a video call`;
            } else {
                return `${this.displayName} started a voice call`;
            }
        } else {
            if (this.type === CallType.Video) {
                return `Video call ended`;
            } else {
                return `Voice call ended`;
            }
        }
    }

    get typeLabel() {
        if (this._call && this._call.usesFoci) {
            return `This call uses a stream-forwarding unit, which isn't supported yet, so you can't join this call.`;
        }
        if (this.type === CallType.Video) {
            return `Video call`;
        } else {
            return `Voice call`;
        }
    }

    get type() {
        return this._entry.event.content["m.type"];
    }

    async join() {
        await this.logAndCatch("CallTile.join", async log => {
            if (this.canJoin) {
                const stream = await this.platform.mediaDevices.getMediaTracks(false, true);
                const localMedia = new LocalMedia().withUserMedia(stream);
                await this._call.join(localMedia, log);
            }
        });
    }

    async leave() {
        await this.logAndCatch("CallTile.leave", async log => {
            if (this.canLeave) {
                await this._call.leave(log);
            }
        });
    }
}

class MemberAvatarViewModel extends ViewModel {
    get _member() {
        return this.getOption("member");
    }

    get userId() {
        return this._member.userId;
    }

    get avatarLetter() {
        return avatarInitials(this._member.member.name);
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this._member.userId);
    }

    avatarUrl(size) {
        const {avatarUrl} = this._member.member;
        const mediaRepository = this.getOption("mediaRepository");
        return getAvatarHttpUrl(avatarUrl, size, this.platform, mediaRepository);
    }

    get avatarTitle() {
        return this._member.member.name;
    }
}
