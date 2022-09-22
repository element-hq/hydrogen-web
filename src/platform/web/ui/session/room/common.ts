/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {TextMessageView} from "./timeline/TextMessageView";
import {ImageView} from "./timeline/ImageView";
import {VideoView} from "./timeline/VideoView";
import {FileView} from "./timeline/FileView";
import {LocationView} from "./timeline/LocationView";
import {MissingAttachmentView} from "./timeline/MissingAttachmentView";
import {AnnouncementView} from "./timeline/AnnouncementView";
import {RedactedView} from "./timeline/RedactedView";
import {SimpleTile} from "../../../../../domain/session/room/timeline/tiles/SimpleTile";
import {GapView} from "./timeline/GapView";
import type {TileViewConstructor, ViewClassForEntryFn} from "./TimelineView";

export function viewClassForTile(vm: SimpleTile): TileViewConstructor {
    switch (vm.shape) {
        case "gap":
            return GapView;
        case "announcement":
            return AnnouncementView;
        case "message":
        case "message-status":
            return TextMessageView;
        case "image":
            return ImageView;
        case "video":
            return VideoView;
        case "file":
            return FileView;
        case "location":
            return LocationView;
        case "missing-attachment":
            return MissingAttachmentView;
        case "redacted":
            return RedactedView;
        default:
            throw new Error(`Tiles of shape "${vm.shape}" are not supported, check the tileClassForEntry function in the view model`);
    }
}
