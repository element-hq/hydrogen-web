/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Platform } from "../platform/web/Platform";
import { MediaRepository } from "../matrix/net/MediaRepository";

export function avatarInitials(name: string): string {
    let firstChar = name.charAt(0);
    if (firstChar === "!" || firstChar === "@" || firstChar === "#") {
        firstChar = name.charAt(1);
    }
    return firstChar.toUpperCase();
}

/**
 * calculates a numeric hash for a given string
 *
 * @param {string} str string to hash
 *
 * @return {number}
 */
function hashCode(str: string): number {
    let hash = 0;
    let i: number;
    let chr: number;
    if (str.length === 0) {
        return hash;
    }
    for (i = 0; i < str.length; i++) {
        chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return Math.abs(hash);
}

export function getIdentifierColorNumber(id: string): number {
    return (hashCode(id) % 8) + 1;
}

export function getAvatarHttpUrl(avatarUrl: string | undefined, cssSize: number, platform: Platform, mediaRepository: MediaRepository): string | undefined {
    if (avatarUrl) {
        const imageSize = cssSize * platform.devicePixelRatio;
        return mediaRepository.mxcUrlThumbnail(avatarUrl, imageSize, imageSize, "crop");
    }
    return undefined;
}

// move to AvatarView.js when converting to typescript
export interface IAvatarContract {
    avatarLetter: string;
    avatarColorNumber: number;
    avatarUrl: (size: number) => string | undefined;
    avatarTitle: string;
}
