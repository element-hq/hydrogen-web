/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {MessageTile} from "./MessageTile.js";

const MAX_HEIGHT = 300;
const MAX_WIDTH = 400;

export class ImageTile extends MessageTile {
    get thumbnailUrl() {
        const mxcUrl = this._getContent()?.url;
        if (typeof mxcUrl === "string") {
            return this._mediaRepository.mxcUrlThumbnail(mxcUrl, this.thumbnailWidth, this.thumbnailHeight, "scale");
        }
        return null;
    }

    get url() {
        const mxcUrl = this._getContent()?.url;
        if (typeof mxcUrl === "string") {
            return this._mediaRepository.mxcUrl(mxcUrl);
        }
        return null;
    }

    _scaleFactor() {
        const info = this._getContent()?.info;
        const scaleHeightFactor = MAX_HEIGHT / info?.h;
        const scaleWidthFactor = MAX_WIDTH / info?.w;
        // take the smallest scale factor, to respect all constraints
        // we should not upscale images, so limit scale factor to 1 upwards
        return Math.min(scaleWidthFactor, scaleHeightFactor, 1);
    }

    get thumbnailWidth() {
        const info = this._getContent()?.info;
        return Math.round(info?.w * this._scaleFactor());
    }

    get thumbnailHeight() {
        const info = this._getContent()?.info;
        return Math.round(info?.h * this._scaleFactor());
    }

    get label() {
        return this._getContent().body;
    }

    get shape() {
        return "image";
    }
}
