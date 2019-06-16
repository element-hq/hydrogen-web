import {tag} from "../general/html.js";

export default class RoomPlaceholderView {
    constructor() {
        this._root = null;
    }

    mount() {
        this._root = tag.div(tag.h2("Choose a room on the left side."));
        return this._root;
    }

    root() {
        return this._root;
    }

    unmount() {}
    update() {}
}
