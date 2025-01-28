/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ViewModel } from "./ViewModel";
import type { Options as BaseOptions } from "./ViewModel";
import type { Session } from "../matrix/Session";
import { ErrorViewModel } from "./ErrorViewModel";
import type { LogCallback, LabelOrValues } from "../logging/types";

export type Options<N extends object> = BaseOptions<N> & {
    session: Session
};

/** Base class for view models that need to report errors to the UI. */
export class ErrorReportViewModel<N extends object, O extends Options<N> = Options<N>> extends ViewModel<N, O> {
    private _errorViewModel?: ErrorViewModel<N>;

    get errorViewModel(): ErrorViewModel<N> | undefined {
        return this._errorViewModel;
    }

    /** Typically you'd want to use `logAndCatch` when implementing a view model method.
     * Use `reportError` when showing errors on your model that were set by
     * background processes using `ErrorBoundary` or you have some other
     * special low-level need to write your try/catch yourself. */
    protected reportError(error: Error) {
        if (this._errorViewModel?.error === error) {
            return;
        }
        this.disposeTracked(this._errorViewModel);
        this._errorViewModel = this.track(new ErrorViewModel(this.childOptions({
            error,
            onClose: () => {
                this._errorViewModel = this.disposeTracked(this._errorViewModel);
                this.emitChange("errorViewModel");
            }
        })));
        this.emitChange("errorViewModel");
    }

    /** Combines logging and error reporting in one method.
     * Wrap the implementation of public view model methods
     * with this to ensure errors are logged and reported.*/
    protected logAndCatch<T>(labelOrValues: LabelOrValues, callback: LogCallback<T>, errorValue: T = undefined as unknown as T): T {
        try {
            let result = this.logger.run(labelOrValues, callback);
            if (result instanceof Promise) {
                result = result.catch(err => {
                    this.reportError(err);
                    return errorValue;
                }) as unknown as T;
            }
            return result;
        } catch (err) {
            this.reportError(err);
            return errorValue;
        }
    }
}
