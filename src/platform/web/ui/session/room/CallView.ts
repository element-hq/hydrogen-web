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
import {classNames} from "../../general/html";
import {Stream} from "../../../../types/MediaDevices";
import type {CallViewModel, CallMemberViewModel, IStreamViewModel} from "../../../../../domain/session/room/CallViewModel";
import { ErrorView } from "../../general/ErrorView";

export class CallView extends TemplateView<CallViewModel> {
    private resizeObserver?: ResizeObserver;
    
    render(t: Builder<CallViewModel>, vm: CallViewModel): Element {
        const members = t.view(new ListView({
            className: "CallView_members",
            list: vm.memberViewModels
        }, vm => new StreamView(vm))) as HTMLElement;
        this.bindMembersCssClasses(t, members);
        return t.div({class: "CallView"}, [
            members,
            //t.p(vm => `Call ${vm.name}`),
            t.div({class: "CallView_buttons"}, [
                t.button({className: {
                    "CallView_mutedMicrophone": vm => vm.isMicrophoneMuted,
                    "CallView_unmutedMicrophone": vm => !vm.isMicrophoneMuted,
                }, onClick: disableTargetCallback(() => vm.toggleMicrophone())}),
                t.button({className: {
                    "CallView_mutedCamera": vm => vm.isCameraMuted,
                    "CallView_unmutedCamera": vm => !vm.isCameraMuted,
                }, onClick: disableTargetCallback(() => vm.toggleCamera())}),
                t.button({className: "CallView_hangup", onClick: disableTargetCallback(() => vm.hangup())}),
            ]),
            t.if(vm => !!vm.errorViewModel, t => {
                return t.div({className: "CallView_error"}, t.view(new ErrorView(vm.errorViewModel!)));
            })
        ]);
    }

    private bindMembersCssClasses(t, members) {
        t.mapSideEffect(vm => vm.memberCount, count => {
            members.classList.forEach((c, _, list) => {
                if (c.startsWith("size")) {
                    list.remove(c);
                }
            });
            members.classList.add(`size${count}`);
        });
        // update classes describing aspect ratio categories
        if (typeof ResizeObserver === "function") {
            const set = (c, flag) => {
                if (flag) {
                    members.classList.add(c);
                } else {
                    members.classList.remove(c);
                }
            };
            this.resizeObserver = new ResizeObserver(() => {
                const ar = members.clientWidth / members.clientHeight;
                const isTall = ar < 0.5;
                const isSquare = !isTall && ar < 1.8
                const isWide = !isTall && !isSquare;
                set("tall", isTall);
                set("square", isSquare);
                set("wide", isWide);
            });
            this.resizeObserver!.observe(members);
        }
    }

    public unmount() {
        if (this.resizeObserver) {
            this.resizeObserver.unobserve((this.root()! as Element).querySelector(".CallView_members")!);
            this.resizeObserver = undefined;
        }
        super.unmount();
    }
}

class StreamView extends TemplateView<IStreamViewModel> {
    render(t: Builder<IStreamViewModel>, vm: IStreamViewModel): Element {
        const video = t.video({
            autoplay: true,
            disablePictureInPicture: true,
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
            }),
            t.if(vm => !!vm.errorViewModel, t => {
                return t.div({className: "StreamView_error"}, t.view(new ErrorView(vm.errorViewModel!)));
            })
        ]);
    }

    update(value, props) {
        super.update(value);
        // update the AvatarView as we told it to not subscribe itself with parentProvidesUpdates
        this.updateSubViews(value, props);
    }
}

function disableTargetCallback(callback: (evt: Event) => Promise<void>): (evt: Event) => Promise<void> {
    return async (evt: Event) => {
        (evt.target as HTMLElement)?.setAttribute("disabled", "disabled");
        await callback(evt);
        (evt.target as HTMLElement)?.removeAttribute("disabled");
    }
}
