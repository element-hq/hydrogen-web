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

import {TemplateView} from "../../general/TemplateView.js";
import {TimelineList} from "./TimelineList.js";
import {MessageComposer} from "./MessageComposer.js";

export class RoomView extends TemplateView {
    constructor(viewModel) {
        super(viewModel);
        this._timelineList = null;
    }

    render(t, vm) {
        this._timelineList = new TimelineList();
        return t.div({className: "RoomView"}, [
            t.div({className: "TimelinePanel"}, [
                t.div({className: "RoomHeader"}, [
                    t.button({className: "back", onClick: () => vm.close()}),
                    t.div({className: `avatar large usercolor${vm.avatarColorNumber}`}, vm => vm.avatarInitials),
                    t.div({className: "room-description"}, [
                        t.h2(vm => vm.name),
                    ]),
                ]),
                t.div({className: "RoomView_error"}, vm => vm.error),
                t.view(this._timelineList),
                t.view(new MessageComposer(this.value.composerViewModel)),
            ])
        ]);
    }

    update(value, prop) {
        super.update(value, prop);
        if (prop === "timelineViewModel") {
            this._timelineList.update({viewModel: this.value.timelineViewModel});
        }
    }
}
