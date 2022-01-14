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

import {TextMessageView} from "./timeline/TextMessageView.js";
import {ImageView} from "./timeline/ImageView.js";
import {VideoView} from "./timeline/VideoView.js";
import {FileView} from "./timeline/FileView.js";
import {LocationView} from "./timeline/LocationView.js";
import {MissingAttachmentView} from "./timeline/MissingAttachmentView.js";
import {AnnouncementView} from "./timeline/AnnouncementView.js";
import {RedactedView} from "./timeline/RedactedView.js";
import {SimpleTile} from "../../../../../domain/session/room/timeline/tiles/SimpleTile.js";
import {GapView} from "./timeline/GapView.js";

export type TileView = GapView | AnnouncementView | TextMessageView |
    ImageView | VideoView | FileView | LocationView | MissingAttachmentView | RedactedView;

// TODO: this is what works for a ctor but doesn't actually check we constrain the returned ctors to the types above
type TileViewConstructor = (this: TileView, SimpleTile) => void;
export function viewClassForEntry(entry: SimpleTile): TileViewConstructor | undefined {
    switch (entry.shape) {
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
    }
}
