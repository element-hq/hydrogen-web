import { li } from "./html.js";

export default class RoomTile {
    constructor(room) {
        this._room = room;
        this._root = null;
    }

    mount() {
        this._root = li(null, this._room.name);
        return this._root;
    }

    unmount() {
    }

    update() {
        // no data-binding yet
        this._root.innerText = this._room.name;
    }

    root() {
        return this._root;
    }
}
