/*
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

export function comparePrimitive(a: any, b: any): -1 | 0 | 1 {
    if (a === b) {
        return 0;
    } else {
        return a < b ? -1 : 1;
    }
}

export const TestURLRouter = {
    attach(): void { return; },
    dispose(): void { return; },
    pushUrl(): void { return; },
    tryRestoreLastUrl(): boolean { return true; },
    urlForSegments(): string | undefined { return ""; },
    urlForSegment(): string | undefined { return ""; },
    urlUntilSegment(): string { return ""; },
    urlForPath(): string { return ""; },
    openRoomActionUrl(): string { return ""; },
    createSSOCallbackURL(): string { return ""; },
    normalizeUrl(): void { return; },
}