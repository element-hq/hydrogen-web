import ListView from "../general/ListView.js";
import RoomTile from "./RoomTile.js";
import RoomView from "./room/RoomView.js";
import SwitchView from "../general/SwitchView.js";
import RoomPlaceholderView from "./RoomPlaceholderView.js";
import SyncStatusBar from "./SyncStatusBar.js";
import {tag} from "../general/html.js";

export default class SessionView {
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
        this._syncStatusBar = new SyncStatusBar(this._viewModel.syncStatusViewModel);
        this._roomList = new ListView(
            {
                list: this._viewModel.roomList,
                onItemClick: (roomTile, event) => roomTile.clicked(event)
            },
            (room) => new RoomTile(room)
        );
        this._middleSwitcher = new SwitchView(new RoomPlaceholderView());

        this._root = tag.div({className: "SessionView"}, [
            this._syncStatusBar.mount(),
            tag.div({className: "main"}, [
                this._roomList.mount(),
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
            this._middleSwitcher.switch(new RoomView(this._viewModel.currentRoom));
        }
    }

    // changing viewModel not supported for now
    update() {}
}
