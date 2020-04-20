import {EventEmitter} from "../../utils/EventEmitter.js";
import {RoomTileViewModel} from "./roomlist/RoomTileViewModel.js";
import {RoomViewModel} from "./room/RoomViewModel.js";
import {SyncStatusViewModel} from "./SyncStatusViewModel.js";

export class SessionViewModel extends EventEmitter {
    constructor({session, sync}) {
        super();
        this._session = session;
        this._syncStatusViewModel = new SyncStatusViewModel(sync);
        this._currentRoomViewModel = null;
        const roomTileVMs = this._session.rooms.mapValues((room, emitUpdate) => {
            return new RoomTileViewModel({
                room,
                emitUpdate,
                emitOpen: room => this._openRoom(room)
            });
        });
        this._roomList = roomTileVMs.sortValues((a, b) => a.compare(b));
    }

    get syncStatusViewModel() {
        return this._syncStatusViewModel;
    }

    get roomList() {
        return this._roomList;
    }

    get currentRoom() {
        return this._currentRoomViewModel;
    }

    dispose() {
        if (this._currentRoomViewModel) {
            this._currentRoomViewModel.dispose();
            this._currentRoomViewModel = null;
        }
    }

    _closeCurrentRoom() {
        if (this._currentRoomViewModel) {
            this._currentRoomViewModel.dispose();
            this._currentRoomViewModel = null;
            this.emit("change", "currentRoom");
        }
    }

    _openRoom(room) {
        if (this._currentRoomViewModel) {
            this._currentRoomViewModel.dispose();
        }
        this._currentRoomViewModel = new RoomViewModel({
            room,
            ownUserId: this._session.user.id,
            closeCallback: () => this._closeCurrentRoom(),
        });
        this._currentRoomViewModel.load();
        this.emit("change", "currentRoom");
    }
}

