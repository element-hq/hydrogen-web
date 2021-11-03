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

import {GapTile} from "./tiles/GapTile.js";
import {TextTile} from "./tiles/TextTile.js";
import {RedactedTile} from "./tiles/RedactedTile.js";
import {ImageTile} from "./tiles/ImageTile.js";
import {VideoTile} from "./tiles/VideoTile.js";
import {FileTile} from "./tiles/FileTile.js";
import {LocationTile} from "./tiles/LocationTile.js";
import {RoomNameTile} from "./tiles/RoomNameTile.js";
import {RoomMemberTile} from "./tiles/RoomMemberTile.js";
import {EncryptedEventTile} from "./tiles/EncryptedEventTile.js";
import {EncryptionEnabledTile} from "./tiles/EncryptionEnabledTile.js";
import {MissingAttachmentTile} from "./tiles/MissingAttachmentTile.js";

export function tilesCreator(baseOptions) {
    return function tilesCreator(entry, emitUpdate) {
        const options = Object.assign({entry, emitUpdate}, baseOptions);
        if (entry.isGap) {
            return new GapTile(options);
        } else if (entry.isPending && entry.pendingEvent.isMissingAttachments) {
            return new MissingAttachmentTile(options);
        } else if (entry.eventType) {
            switch (entry.eventType) {
                case "m.room.message": {
                    if (entry.isRedacted) {
                        return new RedactedTile(options);
                    }
                    const content = entry.content;
                    const msgtype = content && content.msgtype;
                    switch (msgtype) {
                        case "m.text":
                        case "m.notice":
                        case "m.emote":
                            return new TextTile(options);
                        case "m.image":
                            return new ImageTile(options);
                        case "m.video":
                            return new VideoTile(options);
                        case "m.file":
                            return new FileTile(options);
                        case "m.location":
                            return new LocationTile(options);
                        default:
                            // unknown msgtype not rendered
                            return null;
                    }
                }
                case "m.room.name":
                    return new RoomNameTile(options);
                case "m.room.member":
                    return new RoomMemberTile(options);
                case "m.room.encrypted":
                    if (entry.isRedacted) {
                        return new RedactedTile(options);
                    }
                    return new EncryptedEventTile(options);
                case "m.room.encryption":
                    return new EncryptionEnabledTile(options);
                default:
                    // unknown type not rendered
                    return null;
            }
        }
    }   
}
