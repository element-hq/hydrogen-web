/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ConnectionError} from "../matrix/error.js";
import type {Timeout} from "../platform/web/dom/Clock.js"
import type {IAbortable} from "./AbortableOperation";

type TimeoutCreator = (ms: number) => Timeout;

export function abortOnTimeout(createTimeout: TimeoutCreator, timeoutAmount: number, requestResult: IAbortable, responsePromise: Promise<Response>) {
    const timeout = createTimeout(timeoutAmount);
    // abort request if timeout finishes first
    let timedOut = false;
    timeout.elapsed().then(
        () => {
            timedOut = true;
            requestResult.abort();
        },
        () => {}    // ignore AbortError when timeout is aborted
    );
    // abort timeout if request finishes first
    return responsePromise.then(
        response => {
            timeout.abort();
            return response;
        },
        err => {
            timeout.abort();
            // map error to TimeoutError
            if (err.name === "AbortError" && timedOut) {
                throw new ConnectionError(`Request timed out after ${timeoutAmount}ms`, true);
            } else {
                throw err;
            }
        }
    );
}

// because impunity only takes one entrypoint currently,
// these tests aren't run by yarn test as that does not
// include platform specific code,
// and this file is only included by platform specific code,
// see how to run in package.json and replace src/main.js with this file.
import {Clock as MockClock} from "../mocks/Clock.js";
import {Request as MockRequest} from "../mocks/Request.js";
import {AbortError} from "../matrix/error.js";
export function tests() {
    return {
        "ConnectionError on timeout": async assert => {
            const clock = new MockClock();
            const request = new MockRequest();
            const promise = abortOnTimeout(clock.createTimeout, 10000, request, request.response());
            clock.elapse(10000);
            await assert.rejects(promise, ConnectionError);
            assert(request.aborted);
        },
        "Abort is canceled once response resolves": async assert => {
            const clock = new MockClock();
            const request = new MockRequest();
            const promise = abortOnTimeout(clock.createTimeout, 10000, request, request.response());
            request.resolve(5);
            clock.elapse(10000);
            assert(!request.aborted);
            assert.equal(await promise, 5);
        },
        "AbortError from request is not mapped to ConnectionError": async assert => {
            const clock = new MockClock();
            const request = new MockRequest();
            const promise = abortOnTimeout(clock.createTimeout, 10000, request, request.response());
            request.reject(new AbortError());
            assert(!request.aborted);
            assert.rejects(promise, AbortError);
        }
    }

}
