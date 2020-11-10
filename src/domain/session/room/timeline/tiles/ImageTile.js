/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {MessageTile} from "./MessageTile.js";

const MAX_HEIGHT = 300;
const MAX_WIDTH = 400;

export class ImageTile extends MessageTile {
    constructor(options) {
        super(options);
        this._decryptedThumbail = null;
        this._decryptedImage = null;
        this._error = null;
        this.load();
        this._lightboxUrl = this.urlCreator.urlForSegments([
            // ensure the right room is active if in grid view
            this.navigation.segment("room", this._room.id),
            this.navigation.segment("lightbox", this._entry.id)
        ]);
    }

    async _loadEncryptedFile(file) {
        const blob = await this._mediaRepository.downloadEncryptedFile(file, true);
        if (this.isDisposed) {
            blob.dispose();
            return;
        }
        return this.track(blob);
    }

    async load() {
        try {
            const thumbnailFile = this._getContent().info?.thumbnail_file;
            const file = this._getContent().file;
            if (thumbnailFile) {
                this._decryptedThumbail = await this._loadEncryptedFile(thumbnailFile);
                this.emitChange("thumbnailUrl");
            } else if (file) {
                this._decryptedImage = await this._loadEncryptedFile(file);
                this.emitChange("thumbnailUrl");
            }
        } catch (err) {
            this._error = err;
            this.emitChange("error");
        }
    }

    get lightboxUrl() {
        return this._lightboxUrl;
    }

    get thumbnailUrl() {
        if (this._decryptedThumbail) {
            return this._decryptedThumbail.url;
        } else if (this._decryptedImage) {
            return this._decryptedImage.url;
        }
        const mxcUrl = this._getContent()?.url;
        if (typeof mxcUrl === "string") {
            return this._mediaRepository.mxcUrlThumbnail(mxcUrl, this.thumbnailWidth, this.thumbnailHeight, "scale");
        }
        return "";
    }

    async loadImageUrl() {
        if (!this._decryptedImage) {
            const file = this._getContent().file;
            if (file) {
                this._decryptedImage = await this._loadEncryptedFile(file);
            }
        }
        return this._decryptedImage?.url || "";
    }

    _scaleFactor() {
        const info = this._getContent()?.info;
        const scaleHeightFactor = MAX_HEIGHT / info?.h;
        const scaleWidthFactor = MAX_WIDTH / info?.w;
        // take the smallest scale factor, to respect all constraints
        // we should not upscale images, so limit scale factor to 1 upwards
        return Math.min(scaleWidthFactor, scaleHeightFactor, 1);
    }

    get thumbnailWidth() {
        const info = this._getContent()?.info;
        return Math.round(info?.w * this._scaleFactor());
    }

    get thumbnailHeight() {
        const info = this._getContent()?.info;
        return Math.round(info?.h * this._scaleFactor());
    }

    get label() {
        return this._getContent().body;
    }

    get error() {
        if (this._error) {
            return `Could not decrypt image: ${this._error.message}`;
        }
        return null;
    }

    get shape() {
        return "image";
    }
}
