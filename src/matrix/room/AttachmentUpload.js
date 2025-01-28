/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {encryptAttachment} from "../e2ee/attachment.js";

export class AttachmentUpload {
    constructor({filename, blob, platform}) {
        this._filename = filename;
        // need to keep around for local preview while uploading
        this._unencryptedBlob = blob;
        this._transferredBlob = this._unencryptedBlob;
        this._platform = platform;
        this._mxcUrl = null;
        this._encryptionInfo = null;
        this._uploadRequest = null;
        this._aborted = false;
        this._error = null;
        this._sentBytes = 0;
    }

    /** important to call after encrypt() if encryption is needed */
    get size() {
        return this._transferredBlob.size;
    }

    get sentBytes() {
        return this._sentBytes;
    }

    abort() {
        this._uploadRequest?.abort();
    }

    get localPreview() {
        return this._unencryptedBlob;
    }

    /** @internal */
    async encrypt() {
        if (this._encryptionInfo) {
            throw new Error("already encrypted");
        }
        const {info, blob} = await encryptAttachment(this._platform, this._transferredBlob);
        this._transferredBlob = blob;
        this._encryptionInfo = info;
    }

    /** @internal */
    async upload(hsApi, progressCallback, log) {
        this._uploadRequest = hsApi.uploadAttachment(this._transferredBlob, this._filename, {
            uploadProgress: sentBytes => {
                this._sentBytes = sentBytes;
                progressCallback();
            },
            log
        });
        const {content_uri} = await this._uploadRequest.response();
        this._mxcUrl = content_uri;
    }

    /** @internal */
    applyToContent(urlPath, content) {
        if (!this._mxcUrl) {
            throw new Error("upload has not finished");
        }
        let prefix = urlPath.substr(0, urlPath.lastIndexOf("url"));
        setPath(`${prefix}info.size`, content, this._transferredBlob.size);
        setPath(`${prefix}info.mimetype`, content, this._unencryptedBlob.mimeType);
        if (this._encryptionInfo) {
            setPath(`${prefix}file`, content, Object.assign(this._encryptionInfo, {
                mimetype: this._unencryptedBlob.mimeType,
                url: this._mxcUrl
            }));
        } else {
            setPath(`${prefix}url`, content, this._mxcUrl);
        }
    }

    dispose() {
        this._unencryptedBlob.dispose();
        this._transferredBlob.dispose();
    }
}

function setPath(path, content, value) {
    const parts = path.split(".");
    let obj = content;
    for (let i = 0; i < (parts.length - 1); i += 1) {
        const key = parts[i];
        if (!obj[key]) {
            obj[key] = {};
        }
        obj = obj[key];
    }
    const propKey = parts[parts.length - 1];
    obj[propKey] = value;
}
