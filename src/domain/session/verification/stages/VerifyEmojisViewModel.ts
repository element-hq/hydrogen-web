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
