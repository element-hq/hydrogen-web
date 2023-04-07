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

import {BlobHandle} from "./BlobHandle.js";
import {domEventAsPromise} from "./utils.js";

export class ImageHandle {
    static async fromBlob(blob) {
        const img = await loadImgFromBlob(blob);
        const {width, height} = img;
        return new ImageHandle(blob, width, height, img);
    }

    constructor(blob, width, height, imgElement) {
        this.blob = blob;
        this.width = width;
        this.height = height;
        this._domElement = imgElement;
    }

    get maxDimension() {
        return Math.max(this.width, this.height);
    }

    async _getDomElement() {
        if (!this._domElement) {
            this._domElement = await loadImgFromBlob(this.blob);
        }
        return this._domElement;
    }

    async scale(maxDimension) {
        const aspectRatio = this.width / this.height;
        const scaleFactor = Math.min(1, maxDimension / (aspectRatio >= 1 ? this.width : this.height));
        const scaledWidth = Math.round(this.width * scaleFactor);
        const scaledHeight = Math.round(this.height * scaleFactor);
        const canvas = document.createElement("canvas");
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        const ctx = canvas.getContext("2d");
        const drawableElement = await this._getDomElement();
        ctx.drawImage(drawableElement, 0, 0, scaledWidth, scaledHeight);
        let mimeType = this.blob.mimeType === "image/jpeg" ? "image/jpeg" : "image/png";
        let nativeBlob;
        if (canvas.toBlob) {
            nativeBlob = await new Promise(resolve => canvas.toBlob(resolve, mimeType));
        } else if (canvas.msToBlob) {
            // TODO: provide a mimetype override in blob handle for this case
            mimeType = "image/png";
            nativeBlob = canvas.msToBlob();
        } else {
            throw new Error("canvas can't be turned into blob");
        }
        // unsafe is ok because it's a jpeg or png image
        const blob = BlobHandle.fromBlobUnsafe(nativeBlob);
        return new ImageHandle(blob, scaledWidth, scaledHeight, null);
    }

    dispose() {
        this.blob.dispose();
    }
}

export class VideoHandle extends ImageHandle {
    get duration() {
        if (typeof this._domElement.duration === "number") {
            return Math.round(this._domElement.duration * 1000);
        }
        return undefined;
    }

    static async fromBlob(blob) {
        const video = await loadVideoFromBlob(blob);
        const {videoWidth, videoHeight} = video;
        return new VideoHandle(blob, videoWidth, videoHeight, video);
    }
}

export function hasReadPixelPermission() {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    const rgb = [
        Math.round(Math.random() * 255),
        Math.round(Math.random() * 255),
        Math.round(Math.random() * 255),
    ]
    ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return data[0] === rgb[0] && data[1] === rgb[1] && data[2] === rgb[2];
}

async function loadImgFromBlob(blob) {
    const img = document.createElement("img");
    const loadPromise = domEventAsPromise(img, "load");
    img.src = blob.url;
    await loadPromise;
    return img;
}

async function loadVideoFromBlob(blob) {
    const video = document.createElement("video");
    video.muted = true;
    const loadPromise = domEventAsPromise(video, "loadedmetadata");
    video.src = blob.url;
    video.load();
    await loadPromise;
    // seek to the first 1/10s to make sure that drawing the video
    // on a canvas won't give a blank image
    const seekPromise = domEventAsPromise(video, "seeked");
    // needed for safari to reliably fire the seeked event,
    // somewhat hacky but using raf for example didn't do the trick
    await new Promise(r => setTimeout(r, 200));
    video.currentTime = 0.1;
    await seekPromise;
    return video;
}
