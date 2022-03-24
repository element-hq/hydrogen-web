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

import {TemplateView} from "../../../general/TemplateView";
import type {CallTile} from "../../../../../../domain/session/room/timeline/tiles/CallTile";

export class CallTileView extends TemplateView<CallTile> {
    render(t, vm) {
        return t.li(
            {className: "AnnouncementView"},
            t.div([
                vm => vm.label,
                t.button({className: "CallTileView_join", hidden: vm => !vm.canJoin}, "Join"),
                t.button({className: "CallTileView_leave", hidden: vm => !vm.canLeave}, "Leave")
            ])
        );
    }
    
    /* This is called by the parent ListView, which just has 1 listener for the whole list */
    onClick(evt) {
        if (evt.target.className === "CallTileView_join") {
            this.value.join();
        } else if (evt.target.className === "CallTileView_leave") {
            this.value.leave();
        }
    }
}
