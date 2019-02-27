import { li } from "./html.js";

export default class RoomTile {
    constructor(viewModel) {
        this._viewModel = viewModel;
        this._root = null;
    }

    mount() {
        this._root = li(null, this._viewModel.name);
        return this._root;
    }

    unmount() {
    }

    update() {
        // no data-binding yet
        this._root.innerText = this._viewModel.name;
    }

    clicked() {
        this._viewModel.open();
    }

    root() {
        return this._root;
    }
}
