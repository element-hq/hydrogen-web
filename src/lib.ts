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

export {Logger} from "./logging/Logger";
export type {ILogItem} from "./logging/types";
export {IDBLogPersister} from "./logging/IDBLogPersister";
export {ConsoleReporter} from "./logging/ConsoleReporter";
export {Platform} from "./platform/web/Platform.js";
export {BlobHandle} from "./platform/web/dom/BlobHandle";
export {Client, LoadStatus} from "./matrix/Client.js";
export {RoomStatus} from "./matrix/room/common";
export {FeatureSet, FeatureFlag} from "./features";
// export everything needed to observe state events on all rooms using session.observeRoomState
export type {RoomStateHandler} from "./matrix/room/state/types";
export type {MemberChange} from "./matrix/room/members/RoomMember";
export type {Transaction} from "./matrix/storage/idb/Transaction";
export type {Room} from "./matrix/room/Room";
export type {StateEvent} from "./matrix/storage/types";
export {PowerLevels} from "./matrix/room/PowerLevels.js";
// export main view & view models
export {createNavigation, createRouter} from "./domain/navigation/index";
export {RootViewModel} from "./domain/RootViewModel.js";
export {RootView} from "./platform/web/ui/RootView.js";
export {SessionViewModel} from "./domain/session/SessionViewModel.js";
export {SessionView} from "./platform/web/ui/session/SessionView.js";
export {RoomViewModel} from "./domain/session/room/RoomViewModel.js";
export {RoomView} from "./platform/web/ui/session/room/RoomView.js";
export {TimelineViewModel} from "./domain/session/room/timeline/TimelineViewModel.js";
export {tileClassForEntry} from "./domain/session/room/timeline/tiles/index";
export type {TimelineEntry, TileClassForEntryFn, Options, TileConstructor} from "./domain/session/room/timeline/tiles/index";
// export timeline tile view models
export {GapTile} from "./domain/session/room/timeline/tiles/GapTile.js";
export {TextTile} from "./domain/session/room/timeline/tiles/TextTile.js";
export {RedactedTile} from "./domain/session/room/timeline/tiles/RedactedTile.js";
export {ImageTile} from "./domain/session/room/timeline/tiles/ImageTile.js";
export {VideoTile} from "./domain/session/room/timeline/tiles/VideoTile.js";
export {FileTile} from "./domain/session/room/timeline/tiles/FileTile.js";
export {LocationTile} from "./domain/session/room/timeline/tiles/LocationTile.js";
export {RoomNameTile} from "./domain/session/room/timeline/tiles/RoomNameTile.js";
export {RoomMemberTile} from "./domain/session/room/timeline/tiles/RoomMemberTile.js";
export {EncryptedEventTile} from "./domain/session/room/timeline/tiles/EncryptedEventTile.js";
export {EncryptionEnabledTile} from "./domain/session/room/timeline/tiles/EncryptionEnabledTile.js";
export {MissingAttachmentTile} from "./domain/session/room/timeline/tiles/MissingAttachmentTile.js";
export {SimpleTile} from "./domain/session/room/timeline/tiles/SimpleTile.js";

export {TimelineView} from "./platform/web/ui/session/room/TimelineView";
export {viewClassForTile} from "./platform/web/ui/session/room/common";
export type {TileViewConstructor, ViewClassForEntryFn} from "./platform/web/ui/session/room/TimelineView";
// export timeline tile views
export {AnnouncementView} from "./platform/web/ui/session/room/timeline/AnnouncementView.js";
export {BaseMediaView} from "./platform/web/ui/session/room/timeline/BaseMediaView.js";
export {BaseMessageView} from "./platform/web/ui/session/room/timeline/BaseMessageView.js";
export {FileView} from "./platform/web/ui/session/room/timeline/FileView.js";
export {GapView} from "./platform/web/ui/session/room/timeline/GapView.js";
export {ImageView} from "./platform/web/ui/session/room/timeline/ImageView.js";
export {LocationView} from "./platform/web/ui/session/room/timeline/LocationView.js";
export {MissingAttachmentView} from "./platform/web/ui/session/room/timeline/MissingAttachmentView.js";
export {ReactionsView} from "./platform/web/ui/session/room/timeline/ReactionsView.js";
export {RedactedView} from "./platform/web/ui/session/room/timeline/RedactedView.js";
export {ReplyPreviewView} from "./platform/web/ui/session/room/timeline/ReplyPreviewView.js";
export {TextMessageView} from "./platform/web/ui/session/room/timeline/TextMessageView.js";
export {VideoView} from "./platform/web/ui/session/room/timeline/VideoView.js";

export {Navigation} from "./domain/navigation/Navigation.js";
export {ComposerViewModel} from "./domain/session/room/ComposerViewModel.js";
export {MessageComposer} from "./platform/web/ui/session/room/MessageComposer.js";
export {TemplateView} from "./platform/web/ui/general/TemplateView";
export {ViewModel} from "./domain/ViewModel";
export {LoadingView} from "./platform/web/ui/general/LoadingView.js";
export {AvatarView} from "./platform/web/ui/AvatarView.js";
export {RoomType} from "./matrix/room/common";
export {EventEmitter} from "./utils/EventEmitter";
export {Disposables} from "./utils/Disposables";
export {LocalMedia} from "./matrix/calls/LocalMedia";
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
} from "./observable/value";
