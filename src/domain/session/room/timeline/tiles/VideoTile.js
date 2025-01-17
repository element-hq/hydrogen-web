/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseMediaTile} from "./BaseMediaTile.js";

export class VideoTile extends BaseMediaTile {
    async loadVideo() {
        const file = this._getContent().file;
        if (file && !this._decryptedFile) {
            this._decryptedFile = await this._loadEncryptedFile(file);
            this.emitChange("videoUrl");
        }
    }

    get videoUrl() {
        if (this._decryptedFile) {
            return this._decryptedFile.url;
        }
        const mxcUrl = this._getContent()?.url;
        if (typeof mxcUrl === "string") {
            return this._mediaRepository.mxcUrl(mxcUrl);
        }
        return "";
    }

    get shape() {
        return "video";
    }

    _isMainResourceImage() {
        return false;
    }
}
