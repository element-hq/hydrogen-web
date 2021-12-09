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
import {formatSize} from "../../../../../utils/formatSize";
import {SendStatus} from "../../../../../matrix/room/sending/PendingEvent.js";

export class FileTile extends BaseMessageTile {
    constructor(options) {
        super(options);
        this._downloadError = null;
        this._downloading = false;
    }

    async download() {
        if (this._downloading || this.isPending) {
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
            this._downloadError = err;
        } finally {
            blob?.dispose();
            this._downloading = false;
        }
        this.emitChange("label");
    }

    get label() {
        if (this._downloadError) {
            return `Could not download file: ${this._downloadError.message}`;
        }
        const content = this._getContent();
        const filename = content.body;

        if (this._entry.isPending) {
            const {pendingEvent} = this._entry;
            switch (pendingEvent?.status) {
                case SendStatus.Waiting:
                    return this.i18n`Waiting to send ${filename}…`;
                case SendStatus.EncryptingAttachments:
                case SendStatus.Encrypting:
                    return this.i18n`Encrypting ${filename}…`;
                case SendStatus.UploadingAttachments:{
                    const percent = Math.round((pendingEvent.attachmentsSentBytes / pendingEvent.attachmentsTotalBytes) * 100);
                    return this.i18n`Uploading ${filename}: ${percent}%`;
                }
                case SendStatus.Sending:
                case SendStatus.Sent:
                    return this.i18n`Sending ${filename}…`;
                case SendStatus.Error:
                    return this.i18n`Error: could not send ${filename}: ${pendingEvent.error.message}`;
                default:
                    return `Unknown send status for ${filename}`;
            }
        } else {
            const size = formatSize(this._getContent().info?.size);
            if (this._downloading) {
                return this.i18n`Downloading ${filename} (${size})…`;
            } else {
                return this.i18n`Download ${filename} (${size})`;
            }   
        }
    }

    get shape() {
        return "file";
    }
}
