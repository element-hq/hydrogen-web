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
import {createEnum} from "../../utils/enum.js";
import {ObservableValue} from "../../observable/ObservableValue.js";
import {AbortError} from "../../utils/error.js";

export const UploadStatus = createEnum("Waiting", "Encrypting", "Uploading", "Uploaded", "Error");

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
        this._uploadRequest = null;
        this._aborted = false;
        this._error = null;
        this._status = new ObservableValue(UploadStatus.Waiting);
    }

    get status() {
        return this._status;
    }

    async upload() {
        if (this._status.get() === UploadStatus.Waiting) {
            this._upload();
        }
        await this._status.waitFor(s => {
            return s === UploadStatus.Error || s === UploadStatus.Uploaded;
        }).promise;
        if (this._status.get() === UploadStatus.Error) {
            throw this._error;
        }
    }

    /** @package */
    async _upload() {
        try {
            let transferredBlob = this._unencryptedBlob;
            if (this._isEncrypted) {
                this._status.set(UploadStatus.Encrypting);
                const {info, blob} = await encryptAttachment(this._platform, this._unencryptedBlob);
                transferredBlob = blob;
                this._encryptionInfo = info;
            }
            if (this._aborted) {
                throw new AbortError("upload aborted during encryption");
            }
            this._status.set(UploadStatus.Uploading);
            this._uploadRequest = this._hsApi.uploadAttachment(transferredBlob, this._filename);
            const {content_uri} = await this._uploadRequest.response();
            this._mxcUrl = content_uri;
            this._transferredBlob = transferredBlob;
            this._status.set(UploadStatus.Uploaded);
        } catch (err) {
            this._error = err;
            this._status.set(UploadStatus.Error);
        }
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
    applyToContent(urlPath, content) {
        if (!this._mxcUrl) {
            throw new Error("upload has not finished");
        }
        let prefix = urlPath.substr(0, urlPath.lastIndexOf("url"));
        setPath(`${prefix}info.size`, content, this._transferredBlob.size);
        setPath(`${prefix}info.mimetype`, content, this._transferredBlob.mimeType);
        if (this._isEncrypted) {
            setPath(`${prefix}file`, content, Object.assign(this._encryptionInfo, {
                mimetype: this._transferredBlob.mimeType,
                url: this._mxcUrl
            }));
        } else {
            setPath(`${prefix}url`, content, this._mxcUrl);
        }
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
