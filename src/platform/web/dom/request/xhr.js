/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    AbortError,
    ConnectionError
} from "../../../../matrix/error.js";
import {addCacheBuster, mapAsFormData} from "./common.js";

class RequestResult {
    constructor(promise, xhr) {
        this._promise = promise;
        this._xhr = xhr;
    }

    abort() {
        this._xhr.abort();
    }

    response() {
        return this._promise;
    }
}

function createXhr(url, {method, headers, timeout, format, uploadProgress}) {
    const xhr = new XMLHttpRequest();

    if (uploadProgress) {
        xhr.upload.addEventListener("progress", evt => uploadProgress(evt.loaded));
    }

    xhr.open(method, url);
    
    if (format === "buffer") {
        // important to call this after calling open
        xhr.responseType = "arraybuffer";
    }
    if (headers) {
        for(const [name, value] of headers.entries()) {
            try {
                xhr.setRequestHeader(name, value);
            } catch (err) {
                console.info(`Could not set ${name} header: ${err.message}`);
            }
        }
    }
    if (timeout) {
        xhr.timeout = timeout;
    }

    return xhr;
}

function xhrAsPromise(xhr, method, url) {
    return new Promise((resolve, reject) => {
        xhr.addEventListener("load", () => resolve(xhr));
        xhr.addEventListener("abort", () => reject(new AbortError()));
        xhr.addEventListener("error", () => reject(new ConnectionError(`Error ${method} ${url}`)));
        xhr.addEventListener("timeout", () => reject(new ConnectionError(`Timeout ${method} ${url}`, true)));
    });
}

export function xhrRequest(url, options) {
    let {cache, format, body, method} = options;
    if (!cache) {
        url = addCacheBuster(url);
    }
    const xhr = createXhr(url, options);
    const promise = xhrAsPromise(xhr, method, url).then(xhr => {
        const {status} = xhr;
        let body = null;
        if (format === "buffer") {
            body = xhr.response;
        } else if (xhr.getResponseHeader("Content-Type") === "application/json") {
            body = JSON.parse(xhr.responseText);
        }
        return {status, body};
    });

    // if a BlobHandle, take native blob
    if (body?.nativeBlob) {
        body = body.nativeBlob;
    }
    if (body instanceof Map) {
        body = mapAsFormData(body);
    }
    xhr.send(body || null);

    return new RequestResult(promise, xhr);
}
