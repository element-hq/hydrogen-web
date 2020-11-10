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
import {formatSize} from "../../../../../utils/formatSize.js";

export class FileTile extends MessageTile {
    constructor(options) {
        super(options);
        this._error = null;
        this._downloading = false;
    }

    async download() {
        if (this._downloading) {
            return;
        }
        const content = this._getContent();
        const filename = content.body;
        this._downloading = true;
        this.emitChange("label");
        let blob;
        try {
            blob = await this._mediaRepository.downloadAttachment(content);
            this.platform.saveFileAs(blob, filename);
        } catch (err) {
            this._error = err;
        } finally {
            blob?.dispose();
            this._downloading = false;
        }
        this.emitChange("label");
    }

    get label() {
        if (this._error) {
            return `Could not decrypt file: ${this._error.message}`;
        }
        const content = this._getContent();
        const filename = content.body;
        const size = formatSize(content.info?.size);
        if (this._downloading) {
            return this.i18n`Downloading ${filename} (${size})…`;
        } else {
            return this.i18n`Download ${filename} (${size})`;
        }
    }

    get error() {
        return null;
    }

    get shape() {
        return "file";
    }
}
