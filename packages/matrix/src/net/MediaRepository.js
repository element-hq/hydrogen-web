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

import {encodeQueryParams} from "./common.js";
import {decryptAttachment} from "../e2ee/attachment.js";

export class MediaRepository {
    constructor({homeserver, platform}) {
        this._homeserver = homeserver;
        this._platform = platform;
    }

    mxcUrlThumbnail(url, width, height, method) {
        const parts = this._parseMxcUrl(url);
        if (parts) {
            const [serverName, mediaId] = parts;
            const httpUrl = `${this._homeserver}/_matrix/media/r0/thumbnail/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`;
            return httpUrl + "?" + encodeQueryParams({width: Math.round(width), height: Math.round(height), method});
        }
        return null;
    }

    mxcUrl(url) {
        const parts = this._parseMxcUrl(url);
        if (parts) {
            const [serverName, mediaId] = parts;
            return `${this._homeserver}/_matrix/media/r0/download/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`;
        } else {
            return null;
        }
    }

    _parseMxcUrl(url) {
        const prefix = "mxc://";
        if (url.startsWith(prefix)) {
            return url.substr(prefix.length).split("/", 2);
        } else {
            return null;
        }
    }

    async downloadEncryptedFile(fileEntry, cache = false) {
        const url = this.mxcUrl(fileEntry.url);
        const {body: encryptedBuffer} = await this._platform.request(url, {method: "GET", format: "buffer", cache}).response();
        const decryptedBuffer = await decryptAttachment(this._platform, encryptedBuffer, fileEntry);
        return this._platform.createBlob(decryptedBuffer, fileEntry.mimetype);
    }

    async downloadPlaintextFile(mxcUrl, mimetype, cache = false) {
        const url = this.mxcUrl(mxcUrl);
        const {body: buffer} = await this._platform.request(url, {method: "GET", format: "buffer", cache}).response();
        return this._platform.createBlob(buffer, mimetype);
    }

    async downloadAttachment(content, cache = false) {
        if (content.file) {
            return this.downloadEncryptedFile(content.file, cache);
        } else {
            return this.downloadPlaintextFile(content.url, content.info?.mimetype, cache);
        }
    }
}
