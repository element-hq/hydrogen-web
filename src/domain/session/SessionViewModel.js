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

    _openRoom(room) {
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

