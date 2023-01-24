/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import {ObservableArray} from "../../../observable";
import {ViewModel, Options as BaseOptions} from "../../ViewModel";
import type {GroupCall} from "../../../matrix/calls/group/GroupCall";
import type {Room} from "../../../matrix/room/Room.js";
import type {Session} from "../../../matrix/Session.js";
import {CallToastNotificationViewModel} from "./CallToastNotificationViewModel";

type Options = {
    session: Session;
} & BaseOptions;

export class ToastCollectionViewModel extends ViewModel<Options> {
    public readonly toastViewModels: ObservableArray<CallToastNotificationViewModel> = new ObservableArray();

    constructor(options: Options) {
        super(options);
        const session = this.getOption("session");
        const callsObservableMap = session.callHandler.calls;
        this.track(callsObservableMap.subscribe(this));
    }

    onAdd(_, call) {
        if (this.shouldShowNotification(call)) {
            const room = this._findRoomForCall(call);
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

    onRemove(_, call) {
        const idx = this.toastViewModels.array.findIndex(vm => vm.call === call);
        if (idx !== -1) {
            this.toastViewModels.remove(idx);
        }
    }

    onUpdate(_, call) {
        const idx = this.toastViewModels.array.findIndex(vm => vm.call === call);
        if (idx !== -1) {
            // todo: is this correct?
            this.toastViewModels.update(idx, this.toastViewModels.at(idx)!);
        }
    }

    onReset() {
        for (let i = 0; i < this.toastViewModels.length; ++i) {
            this.toastViewModels.remove(i);
        }
    }

    private _findRoomForCall(call: GroupCall): Room {
        const id = call.roomId;
        const rooms = this.getOption("session").rooms;
        return rooms.get(id);
    }
    
    private shouldShowNotification(call: GroupCall): boolean {
        const currentlyOpenedRoomId = this.navigation.path.get("room")?.value;
        if (!call.isLoadedFromStorage && call.roomId !== currentlyOpenedRoomId) {
            return true;
        }
        return false;
    }
}
