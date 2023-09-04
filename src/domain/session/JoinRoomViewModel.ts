/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import {ViewModel, Options as BaseOptions} from "../ViewModel";
import {SegmentType} from "../navigation/index";
import type {Session} from "../../matrix/Session.js";
import {joinRoom} from "../../matrix/room/joinRoom";

type Options = BaseOptions & {
    session: Session;
};

export class JoinRoomViewModel extends ViewModel<SegmentType, Options> {
    private _session: Session;
    private _joinInProgress: boolean = false;
    private _error: Error | undefined;
    private _closeUrl: string;

    constructor(options: Readonly<Options>) {
        super(options);
        this._session = options.session;
        this._closeUrl = this.urlRouter.urlUntilSegment("session");
    }

    get closeUrl(): string { return this._closeUrl; }

    async join(roomId: string): Promise<void> {
        this._error = undefined;
        this._joinInProgress = true;
        this.emitChange("joinInProgress");
        try {
            const id = await joinRoom(roomId, this._session);
            this.navigation.push("room", id);
        }
        catch (e) {
            this._error = e;
            this._joinInProgress = false;
            this.emitChange("error");
        }
    }

    get joinInProgress(): boolean {
        return this._joinInProgress;
    }

    get status(): string | undefined {
        if (this._error) {
            return this._error.message;
        } 
        else if(this._joinInProgress){
            return "Joining room";
        }
    }
}
