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

import {TemplateView, Builder} from "../../general/TemplateView";
import {AvatarView} from "../../AvatarView";
import {ListView} from "../../general/ListView";
import {Stream} from "../../../../types/MediaDevices";
import type {CallViewModel, CallMemberViewModel, IStreamViewModel} from "../../../../../domain/session/room/CallViewModel";

export class CallView extends TemplateView<CallViewModel> {
    render(t: Builder<CallViewModel>, vm: CallViewModel): Element {
        return t.div({class: "CallView"}, [
            t.p(vm => `Call ${vm.name} (${vm.id})`),
            t.view(new ListView({list: vm.memberViewModels}, vm => new StreamView(vm))),
            t.div({class: "buttons"}, [
                t.button({onClick: () => vm.leave()}, "Leave"),
                t.button({onClick: () => vm.toggleVideo()}, "Toggle video"),
            ])
        ]);
    }
}

class StreamView extends TemplateView<IStreamViewModel> {
    render(t: Builder<IStreamViewModel>, vm: IStreamViewModel): Element {
        const video = t.video({
            autoplay: true,
            className: {
                hidden: vm => vm.isCameraMuted
            }
        }) as HTMLVideoElement;
        t.mapSideEffect(vm => vm.stream, stream => {
            video.srcObject = stream as MediaStream;
        });
        return t.div({className: "StreamView"}, [
            video,
            t.div({className: {
                StreamView_avatar: true,
                hidden: vm => !vm.isCameraMuted
            }}, t.view(new AvatarView(vm, 96), {parentProvidesUpdates: true})),
            t.div({
                className: {
                    StreamView_muteStatus: true,
                    hidden: vm => !vm.isCameraMuted && !vm.isMicrophoneMuted,
                    microphoneMuted: vm => vm.isMicrophoneMuted && !vm.isCameraMuted,
                    cameraMuted: vm => vm.isCameraMuted,
                }
            })
        ]);
    }

    update(value, props) {
        super.update(value);
        // update the AvatarView as we told it to not subscribe itself with parentProvidesUpdates
        this.updateSubViews(value, props);
    }
}
