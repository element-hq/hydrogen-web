import EventEmitter from "../../EventEmitter.js";
import RoomTileViewModel from "./roomlist/RoomTileViewModel.js";
import RoomViewModel from "./room/RoomViewModel.js";
import SyncStatusViewModel from "./SyncStatusViewModel.js";

export default class SessionViewModel extends EventEmitter {
    constructor(session, sync) {
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

    _openRoom(room) {
        if (this._currentRoomViewModel) {
            this._currentRoomViewModel.disable();
        }
        this._currentRoomViewModel = new RoomViewModel(room, this._session.userId);
        this._currentRoomViewModel.enable();
        this.emit("change", "currentRoom");
    }
}

