import EventEmitter from "../../EventEmitter.js";
import RoomTileViewModel from "./roomlist/RoomTileViewModel.js";
import RoomViewModel from "./room/RoomViewModel.js";

export default class SessionViewModel extends EventEmitter {
    constructor(session) {
        super();
        this._session = session;
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
        this._currentRoomViewModel = new RoomViewModel(room);
        this._currentRoomViewModel.enable();
        this.emit("change", "currentRoom");
    }
}

