/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export enum TimeScope {
    Minute = 60 * 1000,
    Hours = 60 * TimeScope.Minute,
    Day = 24 * TimeScope.Hours,
}

export function formatDuration(milliseconds: number): string {
    let days = 0;
    let hours = 0;
    let minutes = 0;
    if (milliseconds >= TimeScope.Day) {
        days = Math.floor(milliseconds / TimeScope.Day);
        milliseconds -= days * TimeScope.Day;
    }
    if (milliseconds >= TimeScope.Hours) {
        hours = Math.floor(milliseconds / TimeScope.Hours);
        milliseconds -= hours * TimeScope.Hours;
    }
    if (milliseconds >= TimeScope.Minute) {
        minutes = Math.floor(milliseconds / TimeScope.Minute);
        milliseconds -= minutes * TimeScope.Minute;
    }
    const seconds = Math.floor(milliseconds / 1000);
    let result = "";
    if (days) {
        result = `${days}d `;
    }
    if (hours || days) {
        result += `${hours}h `;
    }
    if (minutes || hours || days) {
        result += `${minutes}m `;
    }
    result += `${seconds}s`;
    return result;
}
