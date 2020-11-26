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
        this._imgElement = imgElement;
    }

    get maxDimension() {
        return Math.max(this.width, this.height);
    }

    async _getImgElement() {
        if (!this._imgElement) {
            this._imgElement = await loadImgFromBlob(this.blob);
        }
        return this._imgElement;
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
        const img = await this._getImgElement();
        ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
        let mimeType = this.blob.mimeType === "image/jpeg" ? "image/jpeg" : "image/png";
        let nativeBlob;
        if (canvas.toBlob) {
            nativeBlob = await new Promise(resolve => canvas.toBlob(resolve, mimeType));
        } else if (canvas.msToBlob) {
            mimeType = "image/png";
            nativeBlob = canvas.msToBlob();
        } else {
            throw new Error("canvas can't be turned into blob");
        }
        const blob = BlobHandle.fromBlob(nativeBlob);
        return new ImageHandle(blob, scaledWidth, scaledHeight, null);
    }

    dispose() {
        this.blob.dispose();
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
    let detach;
    const loadPromise = new Promise((resolve, reject) => {
        detach = () => {
            img.removeEventListener("load", resolve);
            img.removeEventListener("error", reject);
        };
        img.addEventListener("load", resolve);
        img.addEventListener("error", reject);
    });
    img.src = blob.url;
    await loadPromise;
    detach();
    return img;
}
