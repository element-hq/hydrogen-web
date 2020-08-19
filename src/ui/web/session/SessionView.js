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

import {ListView} from "../general/ListView.js";
import {RoomTile} from "./RoomTile.js";
import {RoomView} from "./room/RoomView.js";
import {SwitchView} from "../general/SwitchView.js";
import {RoomPlaceholderView} from "./RoomPlaceholderView.js";
import {SessionStatusView} from "./SessionStatusView.js";
import {tag} from "../general/html.js";

export class SessionView {
    constructor(viewModel) {
        this._viewModel = viewModel;
        this._middleSwitcher = null;
        this._roomList = null;
        this._currentRoom = null;
        this._root = null;
        this._onViewModelChange = this._onViewModelChange.bind(this);
    }

    root() {
        return this._root;
    }

    mount() {
        this._viewModel.on("change", this._onViewModelChange);
        this._sessionStatusBar = new SessionStatusView(this._viewModel.sessionStatusViewModel);
        this._roomList = new ListView(
            {
                className: "RoomList",
                list: this._viewModel.roomList,
                onItemClick: (roomTile, event) => roomTile.clicked(event)
            },
            (room) => new RoomTile(room)
        );
        this._middleSwitcher = new SwitchView(new RoomPlaceholderView());

        this._root = tag.div({className: "SessionView"}, [
            this._sessionStatusBar.mount(),
            tag.div({className: "main"}, [
                tag.div({className: "LeftPanel"}, this._roomList.mount()),
                this._middleSwitcher.mount()
            ])
        ]);
        
        return this._root;
    }

    unmount() {
        this._roomList.unmount();
        this._middleSwitcher.unmount();
        this._viewModel.off("change", this._onViewModelChange);
    }

    _onViewModelChange(prop) {
        if (prop === "currentRoom") {
            if (this._viewModel.currentRoom) {
                this._root.classList.add("room-shown");
                this._middleSwitcher.switch(new RoomView(this._viewModel.currentRoom));
            } else {
                this._root.classList.remove("room-shown");
                this._middleSwitcher.switch(new RoomPlaceholderView());
            }
        }
    }

    // changing viewModel not supported for now
    update() {}
}
