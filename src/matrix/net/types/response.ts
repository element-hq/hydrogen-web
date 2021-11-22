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

export interface IAttachment {
    body: string;
    info: IAttachmentInfo;
    // todo: what about m.audio?
    msgtype: "m.image" | "m.file" | "m.video";
    url?: string;
    file?: IEncryptedFile;
    filename?: string;
}

export interface IEncryptedFile {
    key: JsonWebKey;
    iv: string;
    hashes: {
        sha256: string;
    };
    url: string;
    v: string;
    mimetype?: string;
}

interface IAttachmentInfo {
    h?: number;
    w?: number;
    mimetype: string;
    size: number;
    duration?: number;
    thumbnail_url?: string;
    thumbnail_file?: IEncryptedFile;
    thumbnail_info?: IThumbnailInfo;
}

interface IThumbnailInfo {
    h: number;
    w: number;
    mimetype: string;
    size: number;
}

export interface IVersionResponse {
    versions: string[];
    unstable_features?: Record<string, boolean>;
}
