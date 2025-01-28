/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
