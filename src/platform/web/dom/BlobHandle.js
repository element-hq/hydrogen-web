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


// WARNING: We have to be very careful about what mime-types we allow into blobs.
//
// This means that the content is rendered using the origin of the script which
// called createObjectURL(), and so if the content contains any scripting then it
// will pose a XSS vulnerability when the browser renders it.  This is particularly
// bad if the user right-clicks the URI and pastes it into a new window or tab,
// as the blob will then execute with access to Element's full JS environment(!)
//
// See https://github.com/matrix-org/matrix-react-sdk/pull/1820#issuecomment-385210647
// for details.
//
// We mitigate this by only allowing mime-types into blobs which we know don't
// contain any scripting, and instantiate all others as application/octet-stream
// regardless of what mime-type the event claimed.  Even if the payload itself
// is some malicious HTML, the fact we instantiate it with a media mimetype or
// application/octet-stream means the browser doesn't try to render it as such.
//
// One interesting edge case is image/svg+xml, which empirically *is* rendered
// correctly if the blob is set to the src attribute of an img tag (for thumbnails)
// *even if the mimetype is application/octet-stream*.  However, empirically JS
// in the SVG isn't executed in this scenario, so we seem to be okay.
//
// Tested on Chrome 65 and Firefox 60
//
// The list below is taken mainly from
// https://developer.mozilla.org/en-US/docs/Web/HTML/Supported_media_formats
// N.B. Matrix doesn't currently specify which mimetypes are valid in given
// events, so we pick the ones which HTML5 browsers should be able to display
//
// For the record, mime-types which must NEVER enter this list below include:
//   text/html, text/xhtml, image/svg, image/svg+xml, image/pdf, and similar.

const ALLOWED_BLOB_MIMETYPES = {
    'image/jpeg': true,
    'image/gif': true,
    'image/png': true,

    'video/mp4': true,
    'video/webm': true,
    'video/ogg': true,
    'video/quicktime': true,
    'video/VP8': true,

    'audio/mp4': true,
    'audio/webm': true,
    'audio/aac': true,
    'audio/mpeg': true,
    'audio/ogg': true,
    'audio/wave': true,
    'audio/wav': true,
    'audio/x-wav': true,
    'audio/x-pn-wav': true,
    'audio/flac': true,
    'audio/x-flac': true,
};

const DEFAULT_MIMETYPE = 'application/octet-stream';

export class BlobHandle {
    /** 
     * @internal
     * Don't use the constructor directly, instead use fromBuffer or fromBlobUnsafe
     * */
    constructor(blob, buffer = null) {
        this._blob = blob;
        this._buffer = buffer;
        this._url = null;
    }

    static fromBuffer(buffer, mimetype) {
        mimetype = mimetype ? mimetype.split(";")[0].trim() : '';
        if (!ALLOWED_BLOB_MIMETYPES[mimetype]) {
            mimetype = DEFAULT_MIMETYPE;
        }
        return new BlobHandle(new Blob([buffer], {type: mimetype}), buffer);
    }

    /** Does not filter out mimetypes that could execute embedded javascript.
     * It's up to the callee of this method to ensure that the blob won't be
     * rendered by the browser in a way that could allow cross-signing scripting. */
    static fromBlobUnsafe(blob) {
        return new BlobHandle(blob);
    }

    get nativeBlob() {
        return this._blob;
    }

    async readAsBuffer() {
        if (this._buffer) {
            return this._buffer;
        } else {
            const reader = new FileReader();
            const promise = new Promise((resolve, reject) => {
                reader.addEventListener("load", evt => resolve(evt.target.result)); 
                reader.addEventListener("error", evt => reject(evt.target.error)); 
            });
            reader.readAsArrayBuffer(this._blob);
            return promise;
        }
    }

    get url() {
        if (!this._url) {
             this._url = URL.createObjectURL(this._blob);
        }
        return this._url;
    }

    get size() {
        return this._blob.size;
    }

    get mimeType() {
        return this._blob.type || DEFAULT_MIMETYPE;
    }

    dispose() {
        if (this._url) {
            URL.revokeObjectURL(this._url);
            this._url = null;
        }
    }
}
