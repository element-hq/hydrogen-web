import {MessageTile} from "./MessageTile.js";

const MAX_HEIGHT = 300;
const MAX_WIDTH = 400;

export class ImageTile extends MessageTile {
    constructor(options, room) {
        super(options);
        this._room = room;
    }

    get thumbnailUrl() {
        const mxcUrl = this._getContent().url;
        return this._room.mxcUrlThumbnail(mxcUrl, this.thumbnailWidth, this.thumbnailHeigth, "scale");
    }

    get url() {
        const mxcUrl = this._getContent().url;
        return this._room.mxcUrl(mxcUrl);   
    }

    _scaleFactor() {
        const {info} = this._getContent();
        const scaleHeightFactor = MAX_HEIGHT / info.h;
        const scaleWidthFactor = MAX_WIDTH / info.w;
        // take the smallest scale factor, to respect all constraints
        // we should not upscale images, so limit scale factor to 1 upwards
        return Math.min(scaleWidthFactor, scaleHeightFactor, 1);
    }

    get thumbnailWidth() {
        const {info} = this._getContent();
        return Math.round(info.w * this._scaleFactor());
    }

    get thumbnailHeigth() {
        const {info} = this._getContent();
        return Math.round(info.h * this._scaleFactor());
    }

    get label() {
        return this._getContent().body;
    }

    get shape() {
        return "image";
    }
}
