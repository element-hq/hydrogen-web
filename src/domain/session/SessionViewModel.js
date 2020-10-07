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

import {LeftPanelViewModel} from "./leftpanel/LeftPanelViewModel.js";
import {RoomViewModel} from "./room/RoomViewModel.js";
import {SessionStatusViewModel} from "./SessionStatusViewModel.js";
import {RoomGridViewModel} from "./RoomGridViewModel.js";
import {ViewModel} from "../ViewModel.js";

export class SessionViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {sessionContainer} = options;
        this._session = sessionContainer.session;
        this._sessionStatusViewModel = this.track(new SessionStatusViewModel(this.childOptions({
            sync: sessionContainer.sync,
            reconnector: sessionContainer.reconnector,
            session: sessionContainer.session,
        })));
        this._leftPanelViewModel = new LeftPanelViewModel(this.childOptions({
            rooms: this._session.rooms,
            openRoom: this._openRoom.bind(this),
            gridEnabled: {
                get: () => !!this._gridViewModel,
                set: value => this._enabledGrid(value)
            }
        }));
        this._currentRoomTileViewModel = null;
        this._currentRoomViewModel = null;
        this._gridViewModel = null;
    }

    start() {
        this._sessionStatusViewModel.start();
    }

    get middlePanelViewType() {
        if (this._currentRoomViewModel) {
            return "room";
        } else if (this._gridViewModel) {
            return "roomgrid";
        }
        return "placeholder";
    }

    get roomGridViewModel() {
        return this._gridViewModel;
    }

    get leftPanelViewModel() {
        return this._leftPanelViewModel;
    }

    get sessionStatusViewModel() {
        return this._sessionStatusViewModel;
    }

    get roomList() {
        return this._roomList;
    }

    get currentRoom() {
        return this._currentRoomViewModel;
    }

    _enabledGrid(enabled) {
        if (enabled) {
            this._gridViewModel = this.track(new RoomGridViewModel(this.childOptions({width: 3, height: 2})));
            // transfer current room
            if (this._currentRoomViewModel) {
                this.untrack(this._currentRoomViewModel);
                this._gridViewModel.setRoomViewModel(this._currentRoomViewModel, this._currentRoomTileViewModel);
                this._currentRoomViewModel = null;
                this._currentRoomTileViewModel = null;
            }
        } else {
            const VMs = this._gridViewModel.getAndUntrackFirst();
            if (VMs) {
                this._currentRoomViewModel = this.track(VMs.vm);
                this._currentRoomTileViewModel = VMs.tileVM;
                this._currentRoomTileViewModel.open();
            }
            this._gridViewModel = this.disposeTracked(this._gridViewModel);
        }
        this.emitChange("middlePanelViewType");
    }

    _closeCurrentRoom() {
        // no closing in grid for now
        if (!this._gridViewModel) {
            this._currentRoomTileViewModel?.close();
            this._currentRoomViewModel = this.disposeTracked(this._currentRoomViewModel);
            return true;
        }
    }

    _openRoom(room, roomTileVM) {
        // for now, we don't support having the same room opened more than once,
        // so bail out if we already have the room open
        if (this._gridViewModel?.hasRoomId(room.id)) {
            return;
        } else if (this._currentRoomViewModel?._room.id === room.id) {
            return;
        }
        const roomVM = new RoomViewModel(this.childOptions({
            room,
            ownUserId: this._session.user.id,
            closeCallback: () => {
                if (this._closeCurrentRoom()) {
                    this.emitChange("currentRoom");
                }
            },
        }));
        roomVM.load();
        if (this._gridViewModel) {
            this._gridViewModel.setRoomViewModel(roomVM, roomTileVM);
        } else {
            this._closeCurrentRoom();
            this._currentRoomTileViewModel = roomTileVM;
            this._currentRoomViewModel = this.track(roomVM);
            this.emitChange("currentRoom");
        }
    }
}
