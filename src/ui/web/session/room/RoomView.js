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
import {TimelineList} from "./TimelineList.js";
import {TimelineLoadingView} from "./TimelineLoadingView.js";
import {MessageComposer} from "./MessageComposer.js";

export class RoomView extends TemplateView {
    render(t, vm) {
        return t.div({className: "RoomView"}, [
            t.div({className: "TimelinePanel"}, [
                t.div({className: "RoomHeader"}, [
                    t.button({className: "back", onClick: () => vm.close()}),
                    t.div({className: `avatar usercolor${vm.avatarColorNumber}`}, vm => vm.avatarInitials),
                    t.div({className: "room-description"}, [
                        t.h2(vm => vm.name),
                    ]),
                ]),
                t.div({className: "RoomView_error"}, vm => vm.error),
                t.mapView(vm => vm.timelineViewModel, timelineViewModel => {
                    return timelineViewModel ?
                        new TimelineList(timelineViewModel) :
                        new TimelineLoadingView(vm);    // vm is just needed for i18n
                }),
                t.view(new MessageComposer(this.value.composerViewModel)),
            ])
        ]);
    }
}
