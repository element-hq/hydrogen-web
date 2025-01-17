/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {SegmentType} from "../../../navigation/index";
import {ErrorReportViewModel} from "../../../ErrorReportViewModel";
import type {Options as BaseOptions} from "../../../ViewModel";
import type {Session} from "../../../../matrix/Session.js";
import type {CalculateSASStage} from "../../../../matrix/verification/SAS/stages/CalculateSASStage";

type Options = BaseOptions & {
    stage: CalculateSASStage;
    session: Session;
};

export class VerifyEmojisViewModel extends ErrorReportViewModel<SegmentType, Options> {
    private _isWaiting: boolean = false;

    async setEmojiMatch(match: boolean) {
        await this.logAndCatch("VerifyEmojisViewModel.setEmojiMatch", async () => {
            await this.options.stage.setEmojiMatch(match);
            this._isWaiting = true;
            this.emitChange("isWaiting");
        });
    }

    get emojis() {
        return this.options.stage.emoji;
    }

    get kind(): string {
        return "verify-emojis";
    }

    get isWaiting(): boolean {
        return this._isWaiting;
    }
}
