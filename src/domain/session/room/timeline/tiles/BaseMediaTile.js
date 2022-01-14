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

import {BaseMessageTile} from "./BaseMessageTile.js";
import {SendStatus} from "../../../../../matrix/room/sending/PendingEvent.js";
const MAX_HEIGHT = 300;
const MAX_WIDTH = 400;

export class BaseMediaTile extends BaseMessageTile {
    constructor(options) {
        super(options);
        this._decryptedThumbnail = null;
        this._decryptedFile = null;
        this._isVisible = false;
        this._error = null;
    }

    get isUploading() {
        return this.isPending && this._entry.pendingEvent.status === SendStatus.UploadingAttachments;
    }

    get uploadPercentage() {
        const {pendingEvent} = this._entry;
        return pendingEvent && Math.round((pendingEvent.attachmentsSentBytes / pendingEvent.attachmentsTotalBytes) * 100);
    }

    get sendStatus() {
        const {pendingEvent} = this._entry;
        switch (pendingEvent?.status) {
            case SendStatus.Waiting:
                return this.i18n`Waiting…`;
            case SendStatus.EncryptingAttachments:
            case SendStatus.Encrypting:
                return this.i18n`Encrypting…`;
            case SendStatus.UploadingAttachments:
                return this.i18n`Uploading…`;
            case SendStatus.Sending:
                return this.i18n`Sending…`;
            case SendStatus.Error:
                return this.i18n`Error: ${pendingEvent.error.message}`;
            default:
                return "";
        }
    }

    get thumbnailUrl() {
        if (!this._isVisible) {
            return "";
        }
        if (this._decryptedThumbnail) {
            return this._decryptedThumbnail.url;
        } else {
            const thumbnailMxc = this._getContent().info?.thumbnail_url;
            if (thumbnailMxc) {
                return this._mediaRepository.mxcUrlThumbnail(thumbnailMxc, this.width, this.height, "scale");
            }
        }
        if (this._entry.isPending) {
            const attachment = this._entry.pendingEvent.getAttachment("info.thumbnail_url");
            return attachment && attachment.localPreview.url;
        }
        if (this._isMainResourceImage()) {
            if (this._decryptedFile) {
                return this._decryptedFile.url;
            } else {
                const mxcUrl = this._getContent()?.url;
                if (typeof mxcUrl === "string") {
                    return this._mediaRepository.mxcUrlThumbnail(mxcUrl, this.width, this.height, "scale");
                }
            }
        }
        return "";
    }

    notifyVisible() {
        super.notifyVisible();
        this._isVisible = true;
        this.emitChange("thumbnailUrl");
        if (!this.isPending) {
            this._tryLoadEncryptedThumbnail();
        }
    }

    get width() {
        const info = this._getContent()?.info;
        return Math.round(info?.w * this._scaleFactor());
    }

    get height() {
        const info = this._getContent()?.info;
        return Math.round(info?.h * this._scaleFactor());
    }

    get mimeType() {
        const info = this._getContent()?.info;
        return info?.mimetype;
    }

    get label() {
        return this._getContent().body;
    }

    get error() {
        if (this._error) {
            return `Could not load media: ${this._error.message}`;
        }
        return null;
    }

    setViewError(err) {
        this._error = err;
        this.emitChange("error");
    }

    async _loadEncryptedFile(file) {
        const blob = await this._mediaRepository.downloadEncryptedFile(file, true);
        if (this.isDisposed) {
            blob.dispose();
            return;
        }
        return this.track(blob);
    }

    async _tryLoadEncryptedThumbnail() {
        try {
            const thumbnailFile = this._getContent().info?.thumbnail_file;
            const file = this._getContent().file;
            if (thumbnailFile) {
                this._decryptedThumbnail = await this._loadEncryptedFile(thumbnailFile);
                this.emitChange("thumbnailUrl");
            } else if (file && this._isMainResourceImage()) { // is the main resource an image? then try that for a thumbnail
                this._decryptedFile = await this._loadEncryptedFile(file);
                this.emitChange("thumbnailUrl");
            }
        } catch (err) {
            this._error = err;
            this.emitChange("error");
        }
    }

    _scaleFactor() {
        const info = this._getContent()?.info;
        const scaleHeightFactor = MAX_HEIGHT / info?.h;
        const scaleWidthFactor = MAX_WIDTH / info?.w;
        // take the smallest scale factor, to respect all constraints
        // we should not upscale images, so limit scale factor to 1 upwards
        return Math.min(scaleWidthFactor, scaleHeightFactor, 1);
    }

    _isMainResourceImage() {
        return true; // overwritten in VideoTile
    }
}
