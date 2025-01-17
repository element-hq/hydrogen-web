/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {CallToastNotificationViewModel} from "./CallToastNotificationViewModel";
import {ObservableArray} from "../../../../observable";
import {ViewModel, Options as BaseOptions} from "../../../ViewModel";
import {RoomStatus} from "../../../../matrix/room/common";
import type {GroupCall} from "../../../../matrix/calls/group/GroupCall";
import type {Room} from "../../../../matrix/room/Room.js";
import type {Session} from "../../../../matrix/Session.js";
import type {SegmentType} from "../../../navigation";
import type {IToastCollection} from "../IToastCollection";

type Options = {
    session: Session;
} & BaseOptions;


export class CallToastCollectionViewModel extends ViewModel<SegmentType, Options> implements IToastCollection {
    public readonly toastViewModels: ObservableArray<CallToastNotificationViewModel> = new ObservableArray();

    constructor(options: Options) {
        super(options);
        const session = this.getOption("session");
        if (this.features.calls) {
            const callsObservableMap = session.callHandler.calls;
            this.track(callsObservableMap.subscribe(this));
        }
    }

    async onAdd(_, call: GroupCall) {
        if (this._shouldShowNotification(call)) {
            const room = await this._findRoomForCall(call);
            const dismiss = () => {
                const idx = this.toastViewModels.array.findIndex(vm => vm.call === call);
                if (idx !== -1) {
                    this.toastViewModels.remove(idx);
                }
             };
            this.toastViewModels.append(
                new CallToastNotificationViewModel(this.childOptions({ call, room, dismiss }))
            );
        }
    }

    onRemove(_, call: GroupCall) {
        const idx = this.toastViewModels.array.findIndex(vm => vm.call === call);
        if (idx !== -1) {
            this.toastViewModels.remove(idx);
        }
    }

    onUpdate(_, call: GroupCall) {
        const idx = this.toastViewModels.array.findIndex(vm => vm.call === call);
        if (idx !== -1) {
            this.toastViewModels.update(idx, this.toastViewModels.at(idx)!);
        }
    }

    onReset() {
        for (let i = 0; i < this.toastViewModels.length; ++i) {
            this.toastViewModels.remove(i);
        }
    }

    private async _findRoomForCall(call: GroupCall): Promise<Room> {
        const id = call.roomId;
        const session = this.getOption("session");
        const rooms = session.rooms;
        // Make sure that we know of this room, 
        // otherwise wait for it to come through sync
        const observable = await session.observeRoomStatus(id);
        await observable.waitFor(s => s === RoomStatus.Joined).promise;
        const room = rooms.get(id);
        return room;
    }
    
    private _shouldShowNotification(call: GroupCall): boolean {
        const currentlyOpenedRoomId = this.navigation.path.get("room")?.value;
        if (!call.isLoadedFromStorage && call.roomId !== currentlyOpenedRoomId && !call.usesFoci) {
            return true;
        }
        return false;
    }
}
