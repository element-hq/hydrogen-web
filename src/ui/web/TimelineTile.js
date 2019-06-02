import * as html from "./html.js";

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

    update() {}
}

function renderTile(tile) {
    switch (tile.shape) {
        case "message":
            return html.li(null, [html.strong(null, tile.internalId+" "), tile.label]);
        case "gap": {
            const button = html.button(null, (tile.isUp ? "🠝" : "🠟") + " fill gap");
            const handler = () => {
                tile.fill();
                button.removeEventListener("click", handler);
            };
            button.addEventListener("click", handler);
            return html.li(null, [html.strong(null, tile.internalId+" "), button]);
        }
        case "announcement":
            return html.li(null, [html.strong(null, tile.internalId+" "), tile.label]);
        default:
            return html.li(null, [html.strong(null, tile.internalId+" "), "unknown tile shape: " + tile.shape]);
    }
}
