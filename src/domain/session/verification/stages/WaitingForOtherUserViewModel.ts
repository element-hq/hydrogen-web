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

import {ViewModel, Options as BaseOptions} from "../../../ViewModel";
import {SegmentType} from "../../../navigation/index";
import type {SASVerification} from "../../../../matrix/verification/SAS/SASVerification";

type Options = BaseOptions & {
    sas: SASVerification;
};

export class WaitingForOtherUserViewModel extends ViewModel<SegmentType, Options> {
    async cancel() {
        await this.options.sas.abort();
    }

    get title() {
        const message = this.getOption("sas").isCrossSigningAnotherUser
            ? "Waiting for the other user to accept the verification request"
            : "Waiting for any of your device to accept the verification request";
        return this.i18n`${message}`;
    }

    get description() {
        const message = this.getOption("sas").isCrossSigningAnotherUser
            ? "Ask the other user to accept the request from their client!"
            : "Accept the request from the device you wish to verify!";
        return this.i18n`${message}`;
     }

    get kind(): string {
        return "waiting-for-user";
    }
}
