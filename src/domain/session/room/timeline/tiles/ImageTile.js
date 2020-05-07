import {MessageTile} from "./MessageTile.js";

export class ImageTile extends MessageTile {
    constructor(options) {
        super(options);

        // we start loading the image here,
        // and call this._emitUpdate once it's loaded?
        // or maybe we have an becameVisible() callback on tiles where we start loading it?
    }
    get src() {
        return "";
    }

    get width() {
        return 200;
    }

    get height() {
        return 200;
    }

    get label() {
        return "this is an image";
    }
}
