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
