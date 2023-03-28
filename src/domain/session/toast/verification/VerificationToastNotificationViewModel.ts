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
import {BaseClassOptions, BaseToastNotificationViewModel} from ".././BaseToastNotificationViewModel";
import {SegmentType} from "../../../navigation";
import {SASRequest} from "../../../../matrix/verification/SAS/SASRequest";

type Options<N extends MinimumNeededSegmentType = SegmentType> = {
    request: SASRequest;
} & BaseClassOptions<N>;

type MinimumNeededSegmentType = {
    "device-verification": string | boolean;
};

export class VerificationToastNotificationViewModel<N extends MinimumNeededSegmentType = SegmentType, O extends Options<N> = Options<N>> extends BaseToastNotificationViewModel<N, O> {
    constructor(options: O) {
        super(options);
    }

    get kind(): "verification" {
        return "verification";
    }

    get request(): SASRequest {
        return this.getOption("request");
    }

    get otherDeviceId(): string {
        return this.request.deviceId;
    }

    accept() {
        // @ts-ignore
        this.navigation.push("device-verification", this.request.id);
        this.dismiss();
    }

}


