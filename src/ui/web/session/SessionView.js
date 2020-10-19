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

import {LeftPanelView} from "./leftpanel/LeftPanelView.js";
import {RoomView} from "./room/RoomView.js";
import {TemplateView} from "../general/TemplateView.js";
import {StaticView} from "../general/StaticView.js";
import {SessionStatusView} from "./SessionStatusView.js";
import {RoomGridView} from "./RoomGridView.js";
import {SettingsView} from "./SettingsView.js";

export class SessionView extends TemplateView {
    render(t, vm) {
        return t.div({
            className: {
                "SessionView": true,
                "middle-shown": vm => vm.activeSection !== "placeholder"
            },
        }, [
            t.view(new SessionStatusView(vm.sessionStatusViewModel)),
            t.div({className: "main"}, [
                t.view(new LeftPanelView(vm.leftPanelViewModel)),
                t.mapView(vm => vm.activeSection, activeSection => {
                    switch (activeSection) {
                        case "roomgrid":
                            return new RoomGridView(vm.roomGridViewModel);
                        case "placeholder":
                            return new StaticView(t => t.div({className: "room-placeholder"}, t.h2(vm.i18n`Choose a room on the left side.`)));
                        case "settings":
                            return new SettingsView(vm.settingsViewModel);
                        default: //room id
                            return new RoomView(vm.currentRoomViewModel);
                    }
                })
            ])
        ]);
    }
}
