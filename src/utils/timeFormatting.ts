/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
