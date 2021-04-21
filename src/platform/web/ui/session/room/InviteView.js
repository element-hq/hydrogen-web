/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {TemplateView} from "../../general/TemplateView.js";
// import {TimelineList} from "./TimelineList.js";
// import {TimelineLoadingView} from "./TimelineLoadingView.js";
// import {MessageComposer} from "./MessageComposer.js";
import {renderStaticAvatar} from "../../avatar.js";

export class InviteView extends TemplateView {
    render(t, vm) {
        return t.main({className: "InviteView middle"}, [
            t.div({className: "TimelinePanel"}, [
                t.div({className: "RoomHeader middle-header"}, [
                    t.a({className: "button-utility close-middle", href: vm.closeUrl, title: vm.i18n`Close invite`}),
                    renderStaticAvatar(vm, 32),
                    t.div({className: "room-description"}, [
                        t.h2(vm => vm.name),
                    ]),
                ]),
                t.div({className: "RoomView_error"}, vm => vm.error),
                t.div([
                    t.p(`You were invited into this room!`),
                    t.p(t.button({onClick: () => vm.accept()}, vm.i18n`Accept`)),
                    t.p(t.button({onClick: () => vm.reject()}, vm.i18n`Reject`)),
                ])
            ])
        ]);
    }
}
