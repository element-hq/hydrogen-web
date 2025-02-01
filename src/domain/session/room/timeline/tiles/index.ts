/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
import {CallTile} from "./CallTile.js";
import {VerificationTile} from "./VerificationTile.js";
import {UnknownMessageTile} from "./UnknownMessageTile.js";
import {UnknownEventTile} from "./UnknownEventTile.js";

import type {ITile, TileShape} from "./ITile";
import type {Room} from "../../../../../matrix/room/Room";
import type {Session} from "../../../../../matrix/Session";
import type {Timeline} from "../../../../../matrix/room/timeline/Timeline";
import type {FragmentBoundaryEntry} from "../../../../../matrix/room/timeline/entries/FragmentBoundaryEntry";
import type {EventEntry} from "../../../../../matrix/room/timeline/entries/EventEntry";
import type {PendingEventEntry} from "../../../../../matrix/room/timeline/entries/PendingEventEntry";
import type {Options as ViewModelOptions} from "../../../../ViewModel";

export type TimelineEntry = FragmentBoundaryEntry | EventEntry | PendingEventEntry;
export type TileClassForEntryFn = (entry: TimelineEntry) => TileConstructor | undefined;
export type Options = ViewModelOptions & {
    session: Session,
    room: Room,
    timeline: Timeline
    tileClassForEntry: TileClassForEntryFn;
};
export type TileConstructor = new (entry: TimelineEntry, options: Options) => ITile;

export function tileClassForEntry(entry: TimelineEntry, options: Options): TileConstructor | undefined {
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
                    case "m.key.verification.request":
                        const isCrossSigningDisabled = !options.session.features.crossSigning;
                        const userId = options.session.userId;
                        if (isCrossSigningDisabled || entry.sender === userId) {
                            return undefined;
                        }
                        return VerificationTile as unknown as TileConstructor;
                    default:
                        // Unknown messages are rendered using the fallback plain text
                        // representation, including a notice that the message is not
                        // supported.
                        return UnknownMessageTile;
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
            case "org.matrix.msc3401.call": {
                // if prevContent is present, it's an update to a call event, which we don't render
                // as the original event is updated through the call object which receive state event updates
                if (options.features.calls && entry.stateKey && !entry.prevContent) {
                    return CallTile;
                }
                return undefined;
            }

            // These events are handled separately and don't need an extra timeline entry.
            case "m.reaction":
            case "m.room.redaction":
                return undefined;

            // Displaying these events is not supported but they can safely be
            // hidden instead of spamming rooms with warning messages.
            case "m.room.create":
            case "m.room.power_levels":
            case "m.room.join_rules":
            case "m.room.history_visibility":
            case "m.room.guest_access":
            case "m.room.topic":
            case "m.room.avatar":
            case "m.bridge":
            case "uk.half-shot.bridge":
                return undefined;

            // Unknown events are rendered as a placeholder so users notice that
            // there is something that they are missing. Ideally, all events
            // are either added to the "safe-to-ignore" list above, or rendered
            // with proper tile implementations.
            default:
                return UnknownEventTile;
        }
    }
}
