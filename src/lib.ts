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

export {Platform} from "./platform/web/Platform";
export {Client, LoadStatus} from "./matrix/Client";
export {RoomStatus} from "./matrix/room/common";
// export main view & view models
export {createNavigation, createRouter} from "./domain/navigation/index";
export {RootViewModel} from "./domain/RootViewModel";
export {RootView} from "./platform/web/ui/RootView";
export {SessionViewModel} from "./domain/session/SessionViewModel";
export {SessionView} from "./platform/web/ui/session/SessionView";
export {RoomViewModel} from "./domain/session/room/RoomViewModel";
export {RoomView} from "./platform/web/ui/session/room/RoomView";
export {TimelineViewModel} from "./domain/session/room/timeline/TimelineViewModel";
export {tileClassForEntry} from "./domain/session/room/timeline/tiles/index";
export type {TimelineEntry, TileClassForEntryFn, Options, TileConstructor} from "./domain/session/room/timeline/tiles/index";
// export timeline tile view models
export {GapTile} from "./domain/session/room/timeline/tiles/GapTile";
export {TextTile} from "./domain/session/room/timeline/tiles/TextTile";
export {RedactedTile} from "./domain/session/room/timeline/tiles/RedactedTile";
export {ImageTile} from "./domain/session/room/timeline/tiles/ImageTile";
export {VideoTile} from "./domain/session/room/timeline/tiles/VideoTile";
export {FileTile} from "./domain/session/room/timeline/tiles/FileTile";
export {LocationTile} from "./domain/session/room/timeline/tiles/LocationTile";
export {RoomNameTile} from "./domain/session/room/timeline/tiles/RoomNameTile";
export {RoomMemberTile} from "./domain/session/room/timeline/tiles/RoomMemberTile";
export {EncryptedEventTile} from "./domain/session/room/timeline/tiles/EncryptedEventTile";
export {EncryptionEnabledTile} from "./domain/session/room/timeline/tiles/EncryptionEnabledTile";
export {MissingAttachmentTile} from "./domain/session/room/timeline/tiles/MissingAttachmentTile";
export {SimpleTile} from "./domain/session/room/timeline/tiles/SimpleTile";

export {TimelineView} from "./platform/web/ui/session/room/TimelineView";
export {viewClassForTile} from "./platform/web/ui/session/room/common";
export type {TileViewConstructor, ViewClassForEntryFn} from "./platform/web/ui/session/room/TimelineView";
// export timeline tile views
export {AnnouncementView} from "./platform/web/ui/session/room/timeline/AnnouncementView";
export {BaseMediaView} from "./platform/web/ui/session/room/timeline/BaseMediaView";
export {BaseMessageView} from "./platform/web/ui/session/room/timeline/BaseMessageView";
export {FileView} from "./platform/web/ui/session/room/timeline/FileView";
export {GapView} from "./platform/web/ui/session/room/timeline/GapView";
export {ImageView} from "./platform/web/ui/session/room/timeline/ImageView";
export {LocationView} from "./platform/web/ui/session/room/timeline/LocationView";
export {MissingAttachmentView} from "./platform/web/ui/session/room/timeline/MissingAttachmentView";
export {ReactionsView} from "./platform/web/ui/session/room/timeline/ReactionsView";
export {RedactedView} from "./platform/web/ui/session/room/timeline/RedactedView";
export {ReplyPreviewView} from "./platform/web/ui/session/room/timeline/ReplyPreviewView";
export {TextMessageView} from "./platform/web/ui/session/room/timeline/TextMessageView";
export {VideoView} from "./platform/web/ui/session/room/timeline/VideoView";

export {Navigation} from "./domain/navigation/Navigation";
export {ComposerViewModel} from "./domain/session/room/ComposerViewModel";
export {MessageComposer} from "./platform/web/ui/session/room/MessageComposer";
export {TemplateView} from "./platform/web/ui/general/TemplateView";
export {ViewModel} from "./domain/ViewModel";
export {LoadingView} from "./platform/web/ui/general/LoadingView";
export {AvatarView} from "./platform/web/ui/AvatarView";
export {RoomType} from "./matrix/room/common";
export {EventEmitter} from "./utils/EventEmitter";
export {Disposables} from "./utils/Disposables";
// these should eventually be moved to another library
export {
    ObservableArray,
    SortedArray,
    MappedList,
    AsyncMappedList,
    ConcatList,
    ObservableMap
} from "./observable/index";
export {
    BaseObservableValue,
    ObservableValue,
    RetainedObservableValue
} from "./observable/ObservableValue";
