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

import {ViewModel, Options as ViewModelOptions} from "../../ViewModel";
import {BaseTileViewModel} from "./BaseTileViewModel";
import {RoomTileViewModel} from "./RoomTileViewModel";
import {InviteTileViewModel} from "./InviteTileViewModel";
import {RoomBeingCreatedTileViewModel} from "./RoomBeingCreatedTileViewModel";
import {RoomFilter} from "./RoomFilter";
import {ApplyMap, MappedMap, ObservableMap} from "../../../observable/";
import {SortedMapList} from "../../../observable//list/SortedMapList.js";
import {addPanelIfNeeded} from "../../navigation/index.js";
import {Room} from "../../../matrix/room/Room.js";
import {Invite} from "../../../matrix/room/Invite.js";
import {RoomBeingCreated} from "../../../matrix/room/RoomBeingCreated";
import {Session} from "../../../matrix/Session.js";
import {SegmentType} from "../../navigation";
import type {Path} from "../../navigation/Navigation";

type LOptions = { session: Session } & ViewModelOptions;

export class LeftPanelViewModel extends ViewModel<SegmentType, ViewModelOptions> {
    private _currentTileVM?: BaseTileViewModel;
    private _tileViewModelsMap: MappedMap<string, RoomBeingCreated | Invite | Room, BaseTileViewModel>;
    private _tileViewModelsFilterMap: ApplyMap<string, BaseTileViewModel>;
    private _tileViewModels: SortedMapList;
    private _closeUrl?: string = this.urlCreator.urlForSegment("session");
    private _settingsUrl?: string = this.urlCreator.urlForSegment("settings");
    private _createRoomUrl?: string = this.urlCreator.urlForSegment("create-room");
    gridEnabled: boolean;

    constructor(options: LOptions) {
        super(options);
        const {session} = options;
        this._tileViewModelsMap = this._mapTileViewModels(session.roomsBeingCreated, session.invites, session.rooms);
        this._tileViewModelsFilterMap = new ApplyMap(this._tileViewModelsMap);
        this._tileViewModels = this._tileViewModelsFilterMap.sortValues((a, b) => a.compare(b));
        this._setupNavigation();
    }

    _mapTileViewModels(
        roomsBeingCreated: ObservableMap<string, RoomBeingCreated>,
        invites: ObservableMap<string, Invite>,
        rooms: ObservableMap<string, Room>
    ): MappedMap<string, RoomBeingCreated | Invite | Room, BaseTileViewModel> {
        // join is not commutative, invites will take precedence over rooms
        const allTiles = invites.join(roomsBeingCreated, rooms).mapValues((item: RoomBeingCreated | Invite | Room, emitChange) => {
            let vm: BaseTileViewModel;
            if (item.isBeingCreated) {
                vm = new RoomBeingCreatedTileViewModel(
                        this.childOptions({roomBeingCreated: item as RoomBeingCreated, emitChange})
                    );
            } else if (item.isInvite) {
                vm = new InviteTileViewModel(
                        this.childOptions({invite: item as Invite, emitChange})
                    );
            } else {
                vm = new RoomTileViewModel(
                        this.childOptions({room: item as Room, emitChange})
                    );
            }
            const isOpen = this.navigation.path.get("room")?.value === item.id;
            if (isOpen) {
                vm.open();
                this._updateCurrentVM(vm);
            }
            return vm;
        });
        return allTiles;
    }

    _updateCurrentVM(vm: BaseTileViewModel): void {
        // need to also update the current vm here as
        // we can't call `_open` from the ctor as the map
        // is only populated when the view subscribes.
        this._currentTileVM?.close();
        this._currentTileVM = vm;
    }

    get closeUrl(): string | undefined {
        return this._closeUrl;
    }

    get settingsUrl(): string | undefined {
        return this._settingsUrl;
    }

    get createRoomUrl(): string | undefined { return this._createRoomUrl; }

    _setupNavigation(): void {
        const roomObservable = this.navigation.observe("room");
        this.track(roomObservable.subscribe(roomId => this._open(roomId as string)));

        const gridObservable = this.navigation.observe("rooms");
        this.gridEnabled = !!gridObservable.get();
        this.track(gridObservable.subscribe((roomIds: string[]) => {
            const xor = (b1: boolean, b2: boolean): boolean => {
                return (b1 || b2) && !(b1 && b2);
            };
            const changed = xor(this.gridEnabled, !!roomIds);
            this.gridEnabled = !!roomIds;
            if (changed) {
                this.emitChange("gridEnabled");
            }
        }));
    }

    _open(roomId: string): void {
        this._currentTileVM?.close();
        this._currentTileVM = undefined;
        if (roomId) {
            this._currentTileVM = this._tileViewModelsMap.get(roomId);
            this._currentTileVM?.open();
        }
    }

    toggleGrid(): void {
        const room = this.navigation.path.get("room");
        let path = this.navigation.path.until("session");
        if (this.gridEnabled) {
            if (room) {
                path = path.with(room) as Path<SegmentType>;
                path = addPanelIfNeeded(this.navigation, path);
            }
        } else {
            if (room) {
                path = path.with(this.navigation.segment("rooms", [room.value])) as Path<SegmentType>;
                path = path.with(room) as Path<SegmentType>;
                path = addPanelIfNeeded(this.navigation, path);
            } else {
                path = path.with(this.navigation.segment("rooms", [])) as Path<SegmentType>;
                path = path.with(this.navigation.segment("empty-grid-tile", 0)) as Path<SegmentType>;
            }
        }
        this.navigation.applyPath(path);
    }

    get tileViewModels(): SortedMapList {
        return this._tileViewModels;
    }

    clearFilter(): void {
        this._tileViewModelsFilterMap.setApply(undefined);
        this._tileViewModelsFilterMap.applyOnce((_roomId, vm) => vm.hidden = false);
    }

    setFilter(query: string): boolean {
        query = query.trim();
        if (query.length === 0) {
            this.clearFilter();
            return false;
        } else {
            const startFiltering = !this._tileViewModelsFilterMap.hasApply();
            const filter = new RoomFilter(query);
            this._tileViewModelsFilterMap.setApply((roomId, vm) => {
                vm.hidden = !filter.matches(vm);
            });
            return startFiltering;
        }
    }
}
