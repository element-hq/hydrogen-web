/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseMessageTile} from "./BaseMessageTile.js";
import {formatSize} from "../../../../../utils/formatSize";
import {SendStatus} from "../../../../../matrix/room/sending/PendingEvent.js";

export class FileTile extends BaseMessageTile {
    constructor(entry, options) {
        super(entry, options);
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
