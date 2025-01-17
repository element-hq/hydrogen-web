/*
Copyright 2025 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export interface AvatarSource {
    get avatarLetter(): string;
    get avatarColorNumber(): number;
    avatarUrl(size: number): string | undefined;
    get avatarTitle(): string;
}
