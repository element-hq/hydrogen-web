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
import {Stream} from "../../../../types/MediaDevices";
import type {StreamWrapper} from "../../../dom/MediaDevices";
import type {CallViewModel, CallMemberViewModel} from "../../../../../domain/session/room/CallViewModel";

function bindStream<T>(t: TemplateBuilder<T>, video: HTMLVideoElement, propSelector: (vm: T) => Stream | undefined) {
    t.mapSideEffect(vm => propSelector(vm)?.videoTrack?.enabled, (_,__, vm) => {
        const stream = propSelector(vm);
        if (stream) {
            video.srcObject = (stream as StreamWrapper).stream;
            if (stream.videoTrack?.enabled) {
                video.classList.remove("hidden");
            } else {
                video.classList.add("hidden");
            }
        } else {
            video.classList.add("hidden");
        }
    });
    return video;
}

export class CallView extends TemplateView<CallViewModel> {
    render(t: TemplateBuilder<CallViewModel>, vm: CallViewModel): HTMLElement {
        return t.div({class: "CallView"}, [
            t.p(vm => `Call ${vm.name} (${vm.id})`),
            t.div({class: "CallView_me"}, bindStream(t, t.video({autoplay: true, width: 240}), vm => vm.localStream)),
            t.view(new ListView({list: vm.memberViewModels}, vm => new MemberView(vm))),
            t.div({class: "buttons"}, [
                t.button({onClick: () => vm.leave()}, "Leave"),
                t.button({onClick: () => vm.toggleVideo()}, "Toggle video"),
            ])
        ]);
    }
}

class MemberView extends TemplateView<CallMemberViewModel> {
    render(t: TemplateBuilder<CallMemberViewModel>, vm: CallMemberViewModel) {
        return bindStream(t, t.video({autoplay: true, width: 360}), vm => vm.stream);
    }
}

// class StreamView extends TemplateView<Stream> {
//     render(t: TemplateBuilder<Stream)
// }
