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

import {RoomTileViewModel} from "./roomlist/RoomTileViewModel.js";
import {RoomViewModel} from "./room/RoomViewModel.js";
import {SessionStatusViewModel} from "./SessionStatusViewModel.js";
import {ViewModel} from "../ViewModel.js";

export class SessionViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {sessionContainer} = options;
        this._session = sessionContainer.session;
        this._sessionStatusViewModel = this.track(new SessionStatusViewModel(this.childOptions({
            sync: sessionContainer.sync,
            reconnector: sessionContainer.reconnector
        })));
        this._currentRoomTileViewModel = null;
        this._currentRoomViewModel = null;
        const roomTileVMs = this._session.rooms.mapValues((room, emitChange) => {
            return new RoomTileViewModel({
                room,
                emitChange,
                emitOpen: this._openRoom.bind(this)
            });
        });
        this._roomList = roomTileVMs.sortValues((a, b) => a.compare(b));
    }

    start() {
        this._sessionStatusViewModel.start();
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

    _closeCurrentRoom() {
        if (this._currentRoomViewModel) {
            this._currentRoomViewModel = this.disposeTracked(this._currentRoomViewModel);
            this.emitChange("currentRoom");
        }
    }

    _openRoom(room, roomTileVM) {
        if (this._currentRoomTileViewModel) {
            this._currentRoomTileViewModel.close();
        }
        this._currentRoomTileViewModel = roomTileVM;
        if (this._currentRoomViewModel) {
            this._currentRoomViewModel = this.disposeTracked(this._currentRoomViewModel);
        }
        this._currentRoomViewModel = this.track(new RoomViewModel(this.childOptions({
            room,
            ownUserId: this._session.user.id,
            closeCallback: () => this._closeCurrentRoom(),
        })));
        this._currentRoomViewModel.load();
        this.emitChange("currentRoom");
    }
}

