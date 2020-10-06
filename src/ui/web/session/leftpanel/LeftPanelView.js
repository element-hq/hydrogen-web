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

import {ListView} from "../../general/ListView.js";
import {TemplateView} from "../../general/TemplateView.js";
import {RoomTileView} from "./RoomTileView.js";

export class LeftPanelView extends TemplateView {
    render(t, vm) {
        const filterInput = t.input({
            type: "text",
            placeholder: vm.i18n`Filter rooms…`,
            "aria-label": vm.i18n`Filter rooms by name`,
            autocomplete: true,
            name: "room-filter",
            onInput: event => vm.setFilter(event.target.value),
        });
        return t.div({className: "LeftPanel"}, [
            t.div({className: "filter"}, [
                filterInput,
                t.button({onClick: () => {
                    filterInput.value = "";
                    vm.clearFilter();
                }}, vm.i18n`Clear`)
            ]),
            t.view(new ListView(
                {
                    className: "RoomList",
                    list: vm.roomList,
                    onItemClick: (roomTile, event) => roomTile.clicked(event)
                },
                roomTileVM => new RoomTileView(roomTileVM)
            ))
        ]);
    }
}
