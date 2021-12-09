/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

export type Attachment = {
    body: string;
    info: AttachmentInfo;
    msgtype: string;
    url?: string;
    file?: EncryptedFile;
    filename?: string;
}

export type EncryptedFile = {
    key: JsonWebKey;
    iv: string;
    hashes: {
        sha256: string;
    };
    url: string;
    v: string;
    mimetype?: string;
}

type AttachmentInfo = {
    h?: number;
    w?: number;
    mimetype: string;
    size: number;
    duration?: number;
    thumbnail_url?: string;
    thumbnail_file?: EncryptedFile;
    thumbnail_info?: ThumbnailInfo;
}

type ThumbnailInfo = {
    h: number;
    w: number;
    mimetype: string;
    size: number;
}

export type VersionResponse = {
    versions: string[];
    unstable_features?: Record<string, boolean>;
}
