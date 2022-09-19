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

import {IGridItemViewModel} from './IGridItemViewModel';
import {ViewModel} from "../../ViewModel";

import type {Options as ViewModelOptions} from "../../ViewModel";
import type {Session} from "../../../matrix/Session";

type Options = {
    session: Session,
    roomIdOrAlias: string
} & ViewModelOptions

export class UnknownRoomViewModel extends ViewModel implements IGridItemViewModel {
    private _session: Session;
    private roomIdOrAlias: string;
    private _error?: Error;
    private _busy = false;

    constructor(options: Options) {
        super(options);
        const {roomIdOrAlias, session} = options;
        this._session = session;
        this.roomIdOrAlias = roomIdOrAlias;
    }

    get error(): string | undefined {
        return this._error?.message;
    }

    async join(): Promise<void> {
        this._busy = true;
        this.emitChange("busy");
        try {
            const roomId = await this._session.joinRoom(this.roomIdOrAlias);
            // navigate to roomId if we were at the alias
            // so we're subscribed to the right room status
            // and we'll switch to the room view model once
            // the join is synced
            this.navigation.push("room", roomId);
            // keep busy on true while waiting for the join to sync
        } catch (err) {
            this._error = err;
            this._busy = false;
            this.emitChange("error");
        }
    }

    get busy(): boolean {
        return this._busy;
    }

    get kind(): string {
        return "unknown";
    }

    get id(): string {
        return "";
    }

    focus(): void {
        return;
    }
}
