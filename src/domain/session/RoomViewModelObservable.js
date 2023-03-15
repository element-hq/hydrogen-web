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

import {ObservableValue} from "../../observable/value";
import {RoomStatus} from "../../matrix/room/common";

/**
Depending on the status of a room (invited, joined, archived, or none),
we want to show a different view with a different view model
when showing a room. Furthermore, this logic is needed both in the 
single room view and in the grid view. So this logic is extracted here,
and this observable updates with the right view model as the status for
a room changes.

To not have to track the subscription manually in the SessionViewModel and
the RoomGridViewModel, all subscriptions are removed in the dispose method.
Only when transferring a RoomViewModelObservable between the SessionViewModel
and RoomGridViewModel, unsubscribeAll should be  called prior to doing
the transfer, so either parent view model don't keep getting updates for
the now transferred child view model.

This is also why there is an explicit initialize method, see comment there.
*/
export class RoomViewModelObservable extends ObservableValue {
    constructor(sessionViewModel, roomIdOrLocalId) {
        super(null);
        this._statusSubscription = null;
        this._sessionViewModel = sessionViewModel;
        this.id = roomIdOrLocalId;
    }

    /**
    Separate initialize method rather than doing this onSubscribeFirst because 
    we don't want to run this again when transferring this value between
    SessionViewModel and RoomGridViewModel, as onUnsubscribeLast and onSubscribeFirst
    are called in that case.
    */
    async initialize() {
        const {session} = this._sessionViewModel._client;
        const statusObservable = await session.observeRoomStatus(this.id);
        this.set(await this._statusToViewModel(statusObservable.get()));
        this._statusSubscription = statusObservable.subscribe(async status => {
            // first dispose existing VM, if any
            this.get()?.dispose();
            this.set(await this._statusToViewModel(status));
        });
    }

    async _statusToViewModel(status) {
        if (status & RoomStatus.Replaced) {
            if (status & RoomStatus.BeingCreated) {
                const {session} = this._sessionViewModel._client;
                const roomBeingCreated = session.roomsBeingCreated.get(this.id);
                this._sessionViewModel.notifyRoomReplaced(roomBeingCreated.id, roomBeingCreated.roomId);
            } else {
                throw new Error("Don't know how to replace a room with this status: " + (status ^ RoomStatus.Replaced));
            }
        } else if (status & RoomStatus.BeingCreated) {
            return this._sessionViewModel._createRoomBeingCreatedViewModel(this.id);
        } else if (status & RoomStatus.Invited) {
            return this._sessionViewModel._createInviteViewModel(this.id);
        } else if (status & RoomStatus.Joined) {
            return this._sessionViewModel._createRoomViewModelInstance(this.id);
        } else if (status & RoomStatus.Archived) {
            return await this._sessionViewModel._createArchivedRoomViewModel(this.id);
        } else {
            return this._sessionViewModel._createUnknownRoomViewModel(this.id);
        }
    }

    dispose() {
        if (this._statusSubscription) {
            this._statusSubscription = this._statusSubscription();
        }
        this.unsubscribeAll();
        this.get()?.dispose();
    }
}
