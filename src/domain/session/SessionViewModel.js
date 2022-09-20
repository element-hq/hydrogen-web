/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
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

import {LeftPanelViewModel} from "./leftpanel/LeftPanelViewModel.js";
import {RoomViewModel} from "./room/RoomViewModel.js";
import {UnknownRoomViewModel} from "./room/UnknownRoomViewModel.js";
import {InviteViewModel} from "./room/InviteViewModel.js";
import {RoomBeingCreatedViewModel} from "./room/RoomBeingCreatedViewModel.js";
import {LightboxViewModel} from "./room/LightboxViewModel.js";
import {SessionStatusViewModel} from "./SessionStatusViewModel.js";
import {RoomGridViewModel} from "./RoomGridViewModel.js";
import {SettingsViewModel} from "./settings/SettingsViewModel.js";
import {CreateRoomViewModel} from "./CreateRoomViewModel.js";
import {JoinRoomViewModel} from "./JoinRoomViewModel";
import {ViewModel} from "../ViewModel";
import {RoomViewModelObservable} from "./RoomViewModelObservable.js";
import {RightPanelViewModel} from "./rightpanel/RightPanelViewModel.js";
import {SyncStatus} from "../../matrix/Sync.js";

export class SessionViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {client} = options;
        this._client = this.track(client);
        this._sessionStatusViewModel = this.track(new SessionStatusViewModel(this.childOptions({
            sync: client.sync,
            reconnector: client.reconnector,
            session: client.session,
        })));
        this._leftPanelViewModel = this.track(new LeftPanelViewModel(this.childOptions({session: this._client.session})));
        this._settingsViewModel = null;
        this._roomViewModelObservable = null;
        this._gridViewModel = null;
        this._createRoomViewModel = null;
        this._joinRoomViewModel = null;
        this._setupNavigation();
        this._setupForcedLogoutOnAccessTokenInvalidation();
    }

    _setupNavigation() {
        const gridRooms = this.navigation.observe("rooms");
        // this gives us a set of room ids in the grid
        this.track(gridRooms.subscribe(roomIds => {
            this._updateGrid(roomIds);
        }));
        if (gridRooms.get()) {
            this._updateGrid(gridRooms.get());
        }

        const currentRoomId = this.navigation.observe("room");
        // this gives us the active room
        this.track(currentRoomId.subscribe(roomId => {
            if (!this._gridViewModel) {
                this._updateRoom(roomId);
            }
            this._updateRightPanel();
        }));
        if (!this._gridViewModel) {
            this._updateRoom(currentRoomId.get());
        }

        const settings = this.navigation.observe("settings");
        this.track(settings.subscribe(settingsOpen => {
            this._updateSettings(settingsOpen);
        }));
        this._updateSettings(settings.get());

        const createRoom = this.navigation.observe("create-room");
        this.track(createRoom.subscribe(createRoomOpen => {
            this._updateCreateRoom(createRoomOpen);
        }));
        this._updateCreateRoom(createRoom.get());

        const joinRoom = this.navigation.observe("join-room");
        this.track(joinRoom.subscribe((joinRoomOpen) => {
            this._updateJoinRoom(joinRoomOpen);
        }));
        this._updateJoinRoom(joinRoom.get());

        const lightbox = this.navigation.observe("lightbox");
        this.track(lightbox.subscribe(eventId => {
            this._updateLightbox(eventId);
        }));
        this._updateLightbox(lightbox.get());


        const rightpanel = this.navigation.observe("right-panel");
        this.track(rightpanel.subscribe(() => this._updateRightPanel()));
        this._updateRightPanel();
    }

    _setupForcedLogoutOnAccessTokenInvalidation() {
        this.track(this._client.sync.status.subscribe(status => {
            if (status === SyncStatus.Stopped) {
                const error = this._client.sync.error;
                if (error?.errcode === "M_UNKNOWN_TOKEN") {
                    // Access token is no longer valid, so force the user to log out
                    const segments = [
                        this.navigation.segment("logout", this.id),
                        this.navigation.segment("forced", true),
                    ];
                    const path = this.navigation.pathFrom(segments);
                    this.navigation.applyPath(path);
                }
            }
        }));
    }

    get id() {
        return this._client.sessionId;
    }

    start() {
        this._sessionStatusViewModel.start();
    }

    get activeMiddleViewModel() {
        return (
            this._roomViewModelObservable?.get() ||
            this._gridViewModel ||
            this._settingsViewModel ||
            this._createRoomViewModel ||
            this._joinRoomViewModel
        );
    }

    get roomGridViewModel() {
        return this._gridViewModel;
    }

    get leftPanelViewModel() {
        return this._leftPanelViewModel;
    }

    get sessionStatusViewModel() {
        return this._sessionStatusViewModel;
    }

    get settingsViewModel() {
        return this._settingsViewModel;
    }

    get currentRoomViewModel() {
        return this._roomViewModelObservable?.get();
    }

    get rightPanelViewModel() {
        return this._rightPanelViewModel;
    }

    get createRoomViewModel() {
        return this._createRoomViewModel;
    }

    get joinRoomViewModel() {
        return this._joinRoomViewModel;
    }

    _updateGrid(roomIds) {
        const changed = !(this._gridViewModel && roomIds);
        const currentRoomId = this.navigation.path.get("room");
        if (roomIds) {
            if (!this._gridViewModel) {
                this._gridViewModel = this.track(new RoomGridViewModel(this.childOptions({
                    width: 3,
                    height: 2,
                    createRoomViewModelObservable: roomId => new RoomViewModelObservable(this, roomId),
                })));
                // try to transfer the current room view model, so we don't have to reload the timeline
                this._roomViewModelObservable?.unsubscribeAll();
                if (this._gridViewModel.initializeRoomIdsAndTransferVM(roomIds, this._roomViewModelObservable)) {
                    this._roomViewModelObservable = this.untrack(this._roomViewModelObservable);
                } else if (this._roomViewModelObservable) {
                    this._roomViewModelObservable = this.disposeTracked(this._roomViewModelObservable);
                }
            } else {
                this._gridViewModel.setRoomIds(roomIds);
            }
        } else if (this._gridViewModel && !roomIds) {
            // closing grid, try to show focused room in grid
            if (currentRoomId) {
                const vmo = this._gridViewModel.releaseRoomViewModel(currentRoomId.value);
                if (vmo) {
                    this._roomViewModelObservable = this.track(vmo);
                    this._roomViewModelObservable.subscribe(() => {
                        this.emitChange("activeMiddleViewModel");
                    });
                }
            }
            this._gridViewModel = this.disposeTracked(this._gridViewModel);
        }
        if (changed) {
            this.emitChange("activeMiddleViewModel");
        }
    }

    _createRoomViewModelInstance(roomId) {
        const room = this._client.session.rooms.get(roomId);
        if (room) {
            const roomVM = new RoomViewModel(this.childOptions({room}));
            roomVM.load();
            return roomVM;
        }
        return null;
    }

    _createUnknownRoomViewModel(roomIdOrAlias) {
        return new UnknownRoomViewModel(this.childOptions({
            roomIdOrAlias,
            session: this._client.session,
        }));
    }

    async _createArchivedRoomViewModel(roomId) {
        const room = await this._client.session.loadArchivedRoom(roomId);
        if (room) {
            const roomVM = new RoomViewModel(this.childOptions({room}));
            roomVM.load();
            return roomVM;
        }
        return null;
    }

    _createInviteViewModel(roomId) {
        const invite = this._client.session.invites.get(roomId);
        if (invite) {
            return new InviteViewModel(this.childOptions({
                invite,
                mediaRepository: this._client.session.mediaRepository,
            }));
        }
        return null;
    }

    _createRoomBeingCreatedViewModel(localId) {
        const roomBeingCreated = this._client.session.roomsBeingCreated.get(localId);
        if (roomBeingCreated) {
            return new RoomBeingCreatedViewModel(this.childOptions({
                roomBeingCreated,
                mediaRepository: this._client.session.mediaRepository,
            }));
        }
        return null;
    }

    _updateRoom(roomId) {
        // opening a room and already open?
        if (this._roomViewModelObservable?.id === roomId) {
            return;
        }
        // close if needed
        if (this._roomViewModelObservable) {
            this._roomViewModelObservable = this.disposeTracked(this._roomViewModelObservable);
        }
        if (!roomId) {
            // if clearing the activeMiddleViewModel rather than changing to a different one,
            // emit so the view picks it up and show the placeholder
            this.emitChange("activeMiddleViewModel");
            return;
        }
        const vmo = new RoomViewModelObservable(this, roomId);
        this._roomViewModelObservable = this.track(vmo);
        // subscription is unsubscribed in RoomViewModelObservable.dispose, and thus handled by track
        this._roomViewModelObservable.subscribe(() => {
            this.emitChange("activeMiddleViewModel");
        });
        vmo.initialize();
    }

    _updateSettings(settingsOpen) {
        if (this._settingsViewModel) {
            this._settingsViewModel = this.disposeTracked(this._settingsViewModel);
        }
        if (settingsOpen) {
            this._settingsViewModel = this.track(new SettingsViewModel(this.childOptions({
                client: this._client,
            })));
            this._settingsViewModel.load();
        }
        this.emitChange("activeMiddleViewModel");
    }

    _updateCreateRoom(createRoomOpen) {
        if (this._createRoomViewModel) {
            this._createRoomViewModel = this.disposeTracked(this._createRoomViewModel);
        }
        if (createRoomOpen) {
            this._createRoomViewModel = this.track(new CreateRoomViewModel(this.childOptions({session: this._client.session})));
        }
        this.emitChange("activeMiddleViewModel");
    }

    _updateJoinRoom(joinRoomOpen) {
        if (this._joinRoomViewModel) {
            this._joinRoomViewModel = this.disposeTracked(this._joinRoomViewModel);
        }
        if (joinRoomOpen) {
            this._joinRoomViewModel = this.track(new JoinRoomViewModel(this.childOptions({session: this._client.session})));
        }
        this.emitChange("activeMiddleViewModel");
    }

    _updateLightbox(eventId) {
        if (this._lightboxViewModel) {
            this._lightboxViewModel = this.disposeTracked(this._lightboxViewModel);
        }
        if (eventId) {
            const room = this._roomFromNavigation();
            this._lightboxViewModel = this.track(new LightboxViewModel(this.childOptions({eventId, room})));
        }
        this.emitChange("lightboxViewModel");
    }

    get lightboxViewModel() {
        return this._lightboxViewModel;
    }

    _roomFromNavigation() {
        const roomId = this.navigation.path.get("room")?.value;
        const room = this._client.session.rooms.get(roomId);
        return room;
    }

    _updateRightPanel() {
        this._rightPanelViewModel = this.disposeTracked(this._rightPanelViewModel);
        const enable = !!this.navigation.path.get("right-panel")?.value;
        if (enable) {
            const room = this._roomFromNavigation();
            this._rightPanelViewModel = this.track(new RightPanelViewModel(this.childOptions({room, session: this._client.session})));
        }
        this.emitChange("rightPanelViewModel");
    }

    notifyRoomReplaced(oldId, newId) {
        this.navigation.push("room", newId);
    }
}
