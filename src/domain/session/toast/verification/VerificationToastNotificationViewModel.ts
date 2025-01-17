/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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


