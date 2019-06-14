import ListView from "./ListView.js";
import RoomTile from "./RoomTile.js";
import RoomView from "./RoomView.js";
import {tag} from "./html.js";

export default class SessionView {
    constructor(viewModel) {
        this._viewModel = viewModel;
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

        this._root = tag.div({className: "SessionView"});
        this._roomList = new ListView(
            {
                list: this._viewModel.roomList,
                onItemClick: (roomTile, event) => roomTile.clicked(event)
            },
            (room) => new RoomTile(room)
        );
        this._roomList.mount();
        this._root.appendChild(this._roomList.root());

        this._updateCurrentRoom();
        return this._root;
    }

    unmount() {
        this._roomList.unmount();
        if (this._room) {
            this._room.unmount();
        }

        this._viewModel.off("change", this._onViewModelChange);
    }

    _onViewModelChange(prop) {
        if (prop === "currentRoom") {
            this._updateCurrentRoom();
        }
    }

    // changing viewModel not supported for now
    update() {}

    _updateCurrentRoom() {
        if (this._currentRoom) {
            this._currentRoom.root().remove();
            this._currentRoom.unmount();
            this._currentRoom = null;
        }
        if (this._viewModel.currentRoom) {
            this._currentRoom = new RoomView(this._viewModel.currentRoom);
            this._currentRoom.mount();
            this.root().appendChild(this._currentRoom.root());
        }
    }
}
