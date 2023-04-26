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
import type {CancelReason} from "../../../../matrix/verification/SAS/channel/types";
import type {IChannel} from "../../../../matrix/verification/SAS/channel/Channel";

type Options = BaseOptions & {
    cancellation: IChannel["cancellation"];
};

export class VerificationCancelledViewModel extends ViewModel<SegmentType, Options> {
    get cancelCode(): CancelReason {
        return this.options.cancellation!.code;
    }

    get isCancelledByUs(): boolean {
        return this.options.cancellation!.cancelledByUs;
    }

    gotoSettings() {
        this.navigation.push("settings", true);
    }

    get kind(): string {
        return "verification-cancelled";
    }
}
