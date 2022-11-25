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

import {GapTile} from "./GapTile.js";
import {TextTile} from "./TextTile.js";
import {RedactedTile} from "./RedactedTile.js";
import {ImageTile} from "./ImageTile.js";
import {VideoTile} from "./VideoTile.js";
import {FileTile} from "./FileTile.js";
import {LocationTile} from "./LocationTile.js";
import {RoomNameTile} from "./RoomNameTile.js";
import {RoomMemberTile} from "./RoomMemberTile.js";
import {EncryptedEventTile} from "./EncryptedEventTile.js";
import {EncryptionEnabledTile} from "./EncryptionEnabledTile.js";
import {MissingAttachmentTile} from "./MissingAttachmentTile.js";

import type {ITile, TileShape} from "./ITile";
import type {Room} from "../../../../../matrix/room/Room";
import type {Timeline} from "../../../../../matrix/room/timeline/Timeline";
import type {FragmentBoundaryEntry} from "../../../../../matrix/room/timeline/entries/FragmentBoundaryEntry";
import type {EventEntry} from "../../../../../matrix/room/timeline/entries/EventEntry";
import type {PendingEventEntry} from "../../../../../matrix/room/timeline/entries/PendingEventEntry";
import type {Options as ViewModelOptions} from "../../../../ViewModel";

export type TimelineEntry = FragmentBoundaryEntry | EventEntry | PendingEventEntry;
export type TileClassForEntryFn = (entry: TimelineEntry) => TileConstructor | undefined;
export type Options = ViewModelOptions & {
    room: Room,
    timeline: Timeline
    tileClassForEntry: TileClassForEntryFn;
};
export type TileConstructor = new (entry: TimelineEntry, options: Options) => ITile;

export function tileClassForEntry(entry: TimelineEntry): TileConstructor | undefined {
    if (entry.isGap) {
        return GapTile;
    } else if (entry.isPending && entry.pendingEvent.isMissingAttachments) {
        return MissingAttachmentTile;
    } else if (entry.eventType) {
        switch (entry.eventType) {
            case "m.room.message": {
                if (entry.isRedacted) {
                    return RedactedTile;
                }
                const content = entry.content;
                const msgtype = content && content.msgtype;
                switch (msgtype) {
                    case "m.text":
                    case "m.notice":
                    case "m.emote":
                        return TextTile;
                    case "m.image":
                        return ImageTile;
                    case "m.video":
                        return VideoTile;
                    case "m.file":
                        return FileTile;
                    case "m.location":
                        return LocationTile;
                    default:
                        // unknown msgtype not rendered
                        return undefined;
                }
            }
            case "m.room.name":
                return RoomNameTile;
            case "m.room.member":
                return RoomMemberTile;
            case "m.room.encrypted":
                if (entry.isRedacted) {
                    return RedactedTile;
                }
                return EncryptedEventTile;
            case "m.room.encryption":
                return EncryptionEnabledTile;
            default:
                // unknown type not rendered
                return undefined;
        }
    }
}
