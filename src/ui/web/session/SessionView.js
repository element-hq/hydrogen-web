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

import {LeftPanelView} from "./leftpanel/LeftPanelView.js";
import {RoomView} from "./room/RoomView.js";
import {TemplateView} from "../general/TemplateView.js";
import {RoomPlaceholderView} from "./RoomPlaceholderView.js";
import {SessionStatusView} from "./SessionStatusView.js";
import {RoomGridView} from "./RoomGridView.js";

export class SessionView extends TemplateView {
    render(t, vm) {
        return t.div({
            className: {
                "SessionView": true,
                "room-shown": vm => !!vm.selectionId
            },
        }, [
            t.view(new SessionStatusView(vm.sessionStatusViewModel)),
            t.div({className: "main"}, [
                t.view(new LeftPanelView(vm.leftPanelViewModel)),
                t.mapView(vm => vm.selectionId, selectionId => {
                    switch (selectionId) {
                        case "roomgrid":
                            return new RoomGridView(vm.roomGridViewModel);
                        case "placeholder":
                            return new RoomPlaceholderView();
                        default: //room id
                            return new RoomView(vm.currentRoom);
                    }
                })
            ])
        ]);
    }
}
