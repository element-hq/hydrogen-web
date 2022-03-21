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

import {TemplateView, TemplateBuilder} from "../../general/TemplateView";
import {ListView} from "../../general/ListView";
import {Track, TrackType} from "../../../../types/MediaDevices";
import type {TrackWrapper} from "../../../dom/MediaDevices";
import type {CallViewModel, CallMemberViewModel} from "../../../../../domain/session/room/CallViewModel";

function bindVideoTracks<T>(t: TemplateBuilder<T>, video: HTMLVideoElement, propSelector: (vm: T) => Track[]) {
    t.mapSideEffect(propSelector, tracks => {
        console.log("tracks", tracks);
        if (tracks.length) {
            video.srcObject = (tracks[0] as TrackWrapper).stream;
        }
    });
    return video;
}

export class CallView extends TemplateView<CallViewModel> {
    render(t: TemplateBuilder<CallViewModel>, vm: CallViewModel): HTMLElement {
        return t.div({class: "CallView"}, [
            t.p(`Call ${vm.name} (${vm.id})`),
            t.div({class: "CallView_me"}, bindVideoTracks(t, t.video(), vm => vm.localTracks)),
            t.view(new ListView({list: vm.memberViewModels}, vm => new MemberView(vm)))
        ]);
    }
}

class MemberView extends TemplateView<CallMemberViewModel> {
    render(t: TemplateBuilder<CallMemberViewModel>, vm: CallMemberViewModel) {
        return bindVideoTracks(t, t.video(), vm => vm.tracks);
    }
}
