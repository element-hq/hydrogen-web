import {tag} from "./html.js";

export default class TimelineTile {
    constructor(tileVM) {
        this._tileVM = tileVM;
        this._root = null;
    }

    root() {
        return this._root;
    }

    mount() {
        this._root = renderTile(this._tileVM);
        return this._root;
    }

    unmount() {}

    update(vm, paramName) {
    }
}

function renderTile(tile) {
    switch (tile.shape) {
        case "message":
            return tag.li(null, [tag.strong(null, tile.internalId+" "), tile.label]);
        case "announcement":
            return tag.li(null, [tag.strong(null, tile.internalId+" "), tile.label]);
        default:
            return tag.li(null, [tag.strong(null, tile.internalId+" "), "unknown tile shape: " + tile.shape]);
    }
}
