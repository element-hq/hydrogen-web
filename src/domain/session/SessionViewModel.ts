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

import {LeftPanelViewModel} from "./leftpanel/LeftPanelViewModel";
import {RoomViewModel} from "./room/RoomViewModel";
import {UnknownRoomViewModel} from "./room/UnknownRoomViewModel";
import {InviteViewModel} from "./room/InviteViewModel";
import {RoomBeingCreatedViewModel} from "./room/RoomBeingCreatedViewModel";
import {LightboxViewModel} from "./room/LightboxViewModel";
import {SessionStatusViewModel} from "./SessionStatusViewModel";
import {RoomGridViewModel} from "./RoomGridViewModel";
import {SettingsViewModel} from "./settings/SettingsViewModel";
import {CreateRoomViewModel} from "./CreateRoomViewModel";
import {JoinRoomViewModel} from "./JoinRoomViewModel";
import {ViewModel} from "../ViewModel";
import {RoomViewModelObservable} from "./RoomViewModelObservable";
import {RightPanelViewModel} from "./rightpanel/RightPanelViewModel";
import {SyncStatus} from "../../matrix/Sync";

import type {Options as ViewModelOptions} from "../ViewModel";
import type {Client} from "../../matrix/Client";
import type {Room} from "../../matrix/room/Room";
import type {IGridItemViewModel} from "./room/IGridItemViewModel";

type Options = {
    client: Client
} & ViewModelOptions;

export class SessionViewModel extends ViewModel {
    client: Client;
    private _sessionStatusViewModel: SessionStatusViewModel;
    private _leftPanelViewModel: LeftPanelViewModel;
    private _settingsViewModel?: SettingsViewModel;
    private _roomViewModelObservable?: RoomViewModelObservable;
    private _gridViewModel?: RoomGridViewModel;
    private _createRoomViewModel?: CreateRoomViewModel;
    private _rightPanelViewModel?: RightPanelViewModel;
    private _lightboxViewModel?: LightboxViewModel;
    private _joinRoomViewModel?: JoinRoomViewModel;

    constructor(options: Options) {
        super(options);
        const {client} = options;
        this.client = this.track(client);
        this._sessionStatusViewModel = this.track(new SessionStatusViewModel(this.childOptions({
            sync: client.sync,
            reconnector: client.reconnector,
            session: client.session,
        })));
        this._leftPanelViewModel = this.track(new LeftPanelViewModel(this.childOptions({session: this.client.session})));
        this._setupNavigation();
        this._setupForcedLogoutOnAccessTokenInvalidation();
    }

    _setupNavigation(): void {
        const gridRooms = this.navigation.observe("rooms");
        // this gives us a set of room ids in the grid
        this.track(gridRooms.subscribe((roomIds: string[] | undefined) => {
            this._updateGrid(roomIds);
        }));
        if (gridRooms.get()) {
            this._updateGrid(gridRooms.get() as string[] | undefined);
        }

        const currentRoomId = this.navigation.observe("room");
        // this gives us the active room
        this.track(currentRoomId.subscribe((roomId: string | undefined) => {
            if (!this._gridViewModel) {
                this._updateRoom(roomId);
            }
            this._updateRightPanel();
        }));
        if (!this._gridViewModel) {
            this._updateRoom(currentRoomId.get() as string | undefined);
        }

        const settings = this.navigation.observe("settings");
        this.track(settings.subscribe((settingsOpen: boolean | undefined) => {
            this._updateSettings(settingsOpen);
        }));
        this._updateSettings(settings.get() as boolean | undefined);

        const createRoom = this.navigation.observe("create-room");
        this.track(createRoom.subscribe((createRoomOpen: boolean | undefined) => {
            this._updateCreateRoom(createRoomOpen);
        }));
        this._updateCreateRoom(createRoom.get() as boolean | undefined);

        const joinRoom = this.navigation.observe("join-room");
        this.track(joinRoom.subscribe((joinRoomOpen) => {
            this._updateJoinRoom(joinRoomOpen);
        }));
        this._updateJoinRoom(joinRoom.get());

        const lightbox = this.navigation.observe("lightbox");
        this.track(lightbox.subscribe((eventId: string | undefined) => {
            this._updateLightbox(eventId);
        }));
        this._updateLightbox(lightbox.get() as string | undefined);


        const rightpanel = this.navigation.observe("right-panel");
        this.track(rightpanel.subscribe(() => this._updateRightPanel()));
        this._updateRightPanel();
    }

    _setupForcedLogoutOnAccessTokenInvalidation() {
        this.track(this.client.sync!.status.subscribe(status => {
            if (status === SyncStatus.Stopped) {
                const error = this.client.sync!.error;
                if (error?.errcode === "M_UNKNOWN_TOKEN") {
                    // Access token is no longer valid, so force the user to log out
                    const segments = [
                        this.navigation.segment("logout", this.id as unknown as true),
                        this.navigation.segment("forced", true),
                    ];
                    const path = this.navigation.pathFrom(segments);
                    this.navigation.applyPath(path);
                }
            }
        }));
    }

    get id(): string | undefined{
        return this.client.sessionId;
    }

    start(): void {
        this._sessionStatusViewModel.start();
    }

    get activeMiddleViewModel():
        | RoomViewModelObservable
        | RoomGridViewModel
        | SettingsViewModel
        | CreateRoomViewModel
        | JoinRoomViewModel {
        return (
            this._roomViewModelObservable?.get() ||
            this._gridViewModel ||
            this._settingsViewModel ||
            this._createRoomViewModel ||
            this._joinRoomViewModel
        );
    }

    get roomGridViewModel(): RoomGridViewModel | undefined {
        return this._gridViewModel;
    }

    get leftPanelViewModel(): LeftPanelViewModel | undefined {
        return this._leftPanelViewModel;
    }

    get sessionStatusViewModel(): SessionStatusViewModel | undefined {
        return this._sessionStatusViewModel;
    }

    get settingsViewModel(): SettingsViewModel | undefined {
        return this._settingsViewModel;
    }

    get currentRoomViewModel(): IGridItemViewModel | undefined{
        return this._roomViewModelObservable?.get();
    }

    get rightPanelViewModel(): RightPanelViewModel | undefined {
        return this._rightPanelViewModel;
    }

    get createRoomViewModel(): CreateRoomViewModel | undefined {
        return this._createRoomViewModel;
    }

    get joinRoomViewModel() {
        return this._joinRoomViewModel;
    }

    _updateGrid(roomIds: string[] | undefined): void {
        const changed = !(this._gridViewModel && roomIds);
        const currentRoomId = this.navigation.path.get("room");
        if (roomIds) {
            if (!this._gridViewModel) {
                this._gridViewModel = this.track(new RoomGridViewModel(this.childOptions({
                    width: 3,
                    height: 2,
                    createRoomViewModelObservable: (roomId: string) => new RoomViewModelObservable(this, roomId),
                })));
                // try to transfer the current room view model, so we don't have to reload the timeline
                this._roomViewModelObservable?.unsubscribeAll();
                if (this._gridViewModel.initializeRoomIdsAndTransferVM(roomIds, this._roomViewModelObservable)) {
                    this._roomViewModelObservable = this.untrack(this._roomViewModelObservable!);
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
                    this._roomViewModelObservable!.subscribe(() => {
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

    _createRoomViewModelInstance(roomId: string): RoomViewModel | undefined {
        const room = this.client.session.rooms?.get(roomId);
        if (room) {
            const roomVM = new RoomViewModel(this.childOptions({room}));
            void roomVM.load();
            return roomVM;
        }
    }

    _createUnknownRoomViewModel(roomIdOrAlias: string): UnknownRoomViewModel {
        return new UnknownRoomViewModel(this.childOptions({
            roomIdOrAlias,
            session: this.client.session,
        }));
    }

    async _createArchivedRoomViewModel(roomId: string): Promise<RoomViewModel | undefined> {
        const room = await this.client.session.loadArchivedRoom(roomId);
        if (room) {
            const roomVM = new RoomViewModel(this.childOptions({room}));
            void roomVM.load();
            return roomVM;
        }
    }

    _createInviteViewModel(roomId): InviteViewModel | undefined {
        const invite = this.client.session.invites.get(roomId);
        if (invite) {
            return new InviteViewModel(this.childOptions({
                invite,
                mediaRepository: this.client.session.mediaRepository,
            }));
        }
    }

    _createRoomBeingCreatedViewModel(localId): RoomBeingCreatedViewModel | undefined {
        const roomBeingCreated = this.client.session.roomsBeingCreated.get(localId);
        if (roomBeingCreated) {
            return new RoomBeingCreatedViewModel(this.childOptions({
                roomBeingCreated,
                mediaRepository: this.client.session.mediaRepository,
            }));
        }
    }

    _updateRoom(roomId: string | undefined): void {
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
        const vmo = new RoomViewModelObservable(this, roomId as string);
        this._roomViewModelObservable = this.track(vmo);
        // subscription is unsubscribed in RoomViewModelObservable.dispose, and thus handled by track
        this._roomViewModelObservable.subscribe(() => {
            this.emitChange("activeMiddleViewModel");
        });
        void vmo.initialize();
    }

    _updateSettings(settingsOpen: boolean | undefined): void {
        if (this._settingsViewModel) {
            this._settingsViewModel = this.disposeTracked(this._settingsViewModel);
        }
        if (settingsOpen) {
            this._settingsViewModel = this.track(new SettingsViewModel(this.childOptions({
                client: this.client,
            })));
            void this._settingsViewModel.load();
        }
        this.emitChange("activeMiddleViewModel");
    }

    _updateCreateRoom(createRoomOpen: boolean | undefined): void {
        if (this._createRoomViewModel) {
            this._createRoomViewModel = this.disposeTracked(this._createRoomViewModel);
        }
        if (createRoomOpen) {
            this._createRoomViewModel = this.track(new CreateRoomViewModel(this.childOptions({session: this.client.session})));
        }
        this.emitChange("activeMiddleViewModel");
    }

    _updateJoinRoom(joinRoomOpen) {
        if (this._joinRoomViewModel) {
            this._joinRoomViewModel = this.disposeTracked(this._joinRoomViewModel);
        }
        if (joinRoomOpen) {
            this._joinRoomViewModel = this.track(new JoinRoomViewModel(this.childOptions({session: this.client.session})));
        }
        this.emitChange("activeMiddleViewModel");
    }

    _updateLightbox(eventId: string | undefined): void {
        if (this._lightboxViewModel) {
            this._lightboxViewModel = this.disposeTracked(this._lightboxViewModel);
        }
        if (eventId) {
            const room = this._roomFromNavigation();
            this._lightboxViewModel = this.track(new LightboxViewModel(this.childOptions({eventId, room})));
        }
        this.emitChange("lightboxViewModel");
    }

    get lightboxViewModel(): LightboxViewModel | undefined {
        return this._lightboxViewModel;
    }

    _roomFromNavigation(): Room | undefined {
        const roomId = this.navigation.path.get("room")?.value;
        const room = this.client.session.rooms?.get(roomId);
        return room;
    }

    _updateRightPanel(): void {
        this._rightPanelViewModel = this.disposeTracked(this._rightPanelViewModel);
        const enable = !!this.navigation.path.get("right-panel")?.value;
        if (enable) {
            const room = this._roomFromNavigation();
            this._rightPanelViewModel = this.track(new RightPanelViewModel(this.childOptions({room, session: this.client.session})));
        }
        this.emitChange("rightPanelViewModel");
    }

    notifyRoomReplaced(_oldId: string, newId: string): void {
        this.navigation.push("room", newId);
    }
}
