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

import {ErrorReportViewModel} from "../../ErrorReportViewModel";
import type {Options as BaseOptions} from "../../ViewModel";
import type {SegmentType} from "../../navigation";
import type {Room} from "../../../matrix/room/Room.js";
import type {Session} from "../../../matrix/Session.js";

type Options = { room: Room, session: Session } & BaseOptions;

export class InvitePanelViewModel extends ErrorReportViewModel<SegmentType, Options> {
    constructor(options: Options) {
        super(options);
    }

    get type() {
        return "invite";
    }

    get shouldShowBackButton() {
        return true;
    }

    get previousSegmentName() {
        return "members";
    }

    get roomName() {
        return this.getOption("room").name;
    }

    async invite(userId: string) {
        await this.logAndCatch("InvitePanelViewModel.invite", async () => {
            const room = this.getOption("room");
            await room.inviteUser(userId);
            const path = this.navigation.path.until("room");
            this.navigation.applyPath(path);
        });
    }
}
