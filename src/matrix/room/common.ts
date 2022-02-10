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

export function getPrevContentFromStateEvent(event) {
    // where to look for prev_content is a bit of a mess,
    // see https://matrix.to/#/!NasysSDfxKxZBzJJoE:matrix.org/$DvrAbZJiILkOmOIuRsNoHmh2v7UO5CWp_rYhlGk34fQ?via=matrix.org&via=pixie.town&via=amorgan.xyz
    return event.unsigned?.prev_content || event.prev_content;
}

export const REDACTION_TYPE = "m.room.redaction";

export function isRedacted(event) {
    return !!event?.unsigned?.redacted_because;
}

export enum RoomStatus {
    None = 1 << 0,
    BeingCreated = 1 << 1,
    Invited = 1 << 2,
    Joined = 1 << 3,
    Replaced = 1 << 4,
    Archived = 1 << 5,
}

export enum RoomType {
    DirectMessage,
    Private,
    Public
}
