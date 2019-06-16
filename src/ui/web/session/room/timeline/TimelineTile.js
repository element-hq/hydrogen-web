import {tag} from "../../../general/html.js";

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
            return tag.li([tag.strong(tile.internalId+" "), tile.label]);
        case "announcement":
            return tag.li([tag.strong(tile.internalId+" "), tile.announcement]);
        default:
            return tag.li([tag.strong(tile.internalId+" "), "unknown tile shape: " + tile.shape]);
    }
}
