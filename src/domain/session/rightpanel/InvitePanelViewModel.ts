/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
