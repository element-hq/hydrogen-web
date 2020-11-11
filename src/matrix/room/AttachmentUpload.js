/*
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

import {encryptAttachment} from "../e2ee/attachment.js";

export class AttachmentUpload {
    constructor({filename, blob, hsApi, platform, isEncrypted}) {
        this._filename = filename;
        this._unencryptedBlob = blob;
        this._isEncrypted = isEncrypted;
        this._platform = platform;
        this._hsApi = hsApi;
        this._mxcUrl = null;
        this._transferredBlob = null;
        this._encryptionInfo = null;
        this._uploadPromise = null;
        this._uploadRequest = null;
        this._aborted = false;
        this._error = null;
    }

    upload() {
        if (!this._uploadPromise) {
            this._uploadPromise = this._upload();
        }
        return this._uploadPromise;
    }

    async _upload() {
        try {
            let transferredBlob = this._unencryptedBlob;
            if (this._isEncrypted) {
                const {info, blob} = await encryptAttachment(this._platform, this._unencryptedBlob);
                transferredBlob = blob;
                this._encryptionInfo = info;
            }
            if (this._aborted) {
                return;
            }
            this._uploadRequest = this._hsApi.uploadAttachment(transferredBlob, this._filename);
            const {content_uri} = await this._uploadRequest.response();
            this._mxcUrl = content_uri;
            this._transferredBlob = transferredBlob;
        } catch (err) {
            this._error = err;
            throw err;
        }
    }

    get isUploaded() {
        return !!this._transferredBlob;
    }

    /** @public */
    abort() {
        this._aborted = true;
        this._uploadRequest?.abort();
    }

    /** @public */
    get localPreview() {
        return this._unencryptedBlob;
    }

    get error() {
        return this._error;
    }

    /** @package */
    uploaded() {
        if (!this._uploadPromise) {
            throw new Error("upload has not started yet");
        }
        return this._uploadPromise;
    }

    /** @package */
    applyToContent(content) {
        if (!this._mxcUrl) {
            throw new Error("upload has not finished");
        }
        content.info = {
            size: this._transferredBlob.size,
            mimetype: this._unencryptedBlob.mimeType,
        };
        if (this._isEncrypted) {
            content.file = Object.assign(this._encryptionInfo, {
                mimetype: this._unencryptedBlob.mimeType,
                url: this._mxcUrl
            });
        } else {
            content.url = this._mxcUrl;
        }
    }
}
