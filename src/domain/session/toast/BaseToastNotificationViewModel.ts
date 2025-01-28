/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ErrorReportViewModel} from "../../ErrorReportViewModel";
import {Options as BaseOptions} from "../../ViewModel";
import type {Session} from "../../../matrix/Session.js";
import {SegmentType} from "../../navigation";

export type BaseClassOptions<N extends object = SegmentType> = {
    dismiss: () => void;
    session: Session;
} & BaseOptions<N>;

export abstract class BaseToastNotificationViewModel<N extends object = SegmentType, O extends BaseClassOptions<N> = BaseClassOptions<N>> extends ErrorReportViewModel<N, O> {
    constructor(options: O) {
        super(options);
    }

    dismiss(): void {
        this.getOption("dismiss")();
    }

    abstract get kind(): string;
}
