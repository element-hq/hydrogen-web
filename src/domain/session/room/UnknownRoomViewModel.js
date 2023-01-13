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

import {ViewModel} from "../../ViewModel";
import {TimelineViewModel} from "./timeline/TimelineViewModel";

export class UnknownRoomViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {roomIdOrAlias, session, peekable} = options;
        this._session = session;
        this.roomIdOrAlias = roomIdOrAlias;
        this._peekable = peekable;
        this._error = null;
        this._busy = false;

        if ( peekable ) {
            this.peek().then(r => { console.log('peeked', r); });
        }
    }

    get peekable() {
        return this._peekable;
    }

    get error() {
        return this._error?.message;
    }

    async join() {
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

    get busy() {
        return this._busy;
    }

    get kind() {
        return this._peekable ? "peekable" : "unknown";
    }

    get composerViewModel() {
        return null;
    }

    get timelineViewModel() {
        return this._timelineVM;
    }

    async peek() {
        try {
            this._room = await this._session.loadPeekableRoom(this.roomIdOrAlias);
            console.log( 'room instance', this._room );

            const timeline = await this._room.openTimeline();
            console.log('timeline',timeline);
            this._tileOptions = this.childOptions({
                roomVM: this,
                timeline,
                tileClassForEntry: this._tileClassForEntry,
            });
            this._timelineVM = this.track(new TimelineViewModel(this.childOptions({
                tileOptions: this._tileOptions,
                timeline,
            })));
            console.log('emitting', this._timelineVM);
            this.emitChange("timelineViewModel");
        } catch (err) {
            console.error(`room.openTimeline(): ${err.message}:\n${err.stack}`);
            this._timelineError = err;
            this.emitChange("error");
        }
    }
}
