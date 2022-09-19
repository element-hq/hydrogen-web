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

type Image = {
    width: number;
    height: number;
    blob: {
        mimeType: string,
        size: number
    }
}

export type MultiMediaInfo = {
    w: number;
    h: number;
    mimetype: string,
    size: number,
    thumbnail_info?: MultiMediaInfo,
    duration?: number
}

export function imageToInfo(image: Image): MultiMediaInfo {
    return {
        w: image.width,
        h: image.height,
        mimetype: image.blob.mimeType,
        size: image.blob.size
    };
}
