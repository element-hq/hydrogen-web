/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export function addCacheBuster(urlStr, random = Math.random) {
    // XHR doesn't have a good way to disable cache,
    // so add a random query param
    // see https://davidtranscend.com/blog/prevent-ie11-cache-ajax-requests/
    if (urlStr.includes("?")) {
        urlStr = urlStr + "&";
    } else {
        urlStr = urlStr + "?";
    }
    return urlStr + `_cacheBuster=${Math.ceil(random() * Number.MAX_SAFE_INTEGER)}`;
}

export function mapAsFormData(map) {
    const formData = new FormData();
    for (const [name, value] of map) {
        // Special case {name: string, blob: BlobHandle} to set a filename.
        // This is the format returned by platform.openFile
        if (value.blob?.nativeBlob && value.name) {
            formData.set(name, value.blob.nativeBlob, value.name);
        } else {
            formData.set(name, value);
        }
    }
    return formData;
}

export function tests() {
    return {
        "add cache buster": assert => {
            const random = () => 0.5;
            assert.equal(addCacheBuster("http://foo", random), "http://foo?_cacheBuster=4503599627370496");
            assert.equal(addCacheBuster("http://foo?bar=baz", random), "http://foo?bar=baz&_cacheBuster=4503599627370496");
        }
    }
}
