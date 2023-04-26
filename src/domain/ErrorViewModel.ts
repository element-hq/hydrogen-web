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
