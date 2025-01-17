/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ViewModel, Options as BaseOptions } from "./ViewModel";
import {submitLogsFromSessionToDefaultServer} from "./rageshake";
import type { Session } from "../matrix/Session";
import type {SegmentType} from "./navigation/index";

type Options<N extends object> = {
    error: Error
    session: Session,
    onClose: () => void
} & BaseOptions<N>;

export class ErrorViewModel<N extends object = SegmentType, O extends Options<N> = Options<N>> extends ViewModel<N, O> {
    get message(): string {
        return this.error.message;
    }

    get error(): Error {
        return this.getOption("error");
    }

    close() {
        this.getOption("onClose")();
    }

    async submitLogs(): Promise<boolean> {
        try {
            await submitLogsFromSessionToDefaultServer(this.getOption("session"), this.platform);
            return true;
        } catch (err) {
            return false;
        }
    }
}
