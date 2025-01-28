/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
