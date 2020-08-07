/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {
    AbortError,
    ConnectionError
} from "../../error.js";
import {abortOnTimeout} from "../timeout.js";

class RequestResult {
    constructor(promise, controller) {
        if (!controller) {
            const abortPromise = new Promise((_, reject) => {
                this._controller = {
                    abort() {
                        const err = new Error("fetch request aborted");
                        err.name = "AbortError";
                        reject(err);
                    }
                };
            });
            this.promise = Promise.race([promise, abortPromise]);
        } else {
            this.promise = promise;
            this._controller = controller;
        }
    }

    abort() {
        this._controller.abort();
    }

    response() {
        return this.promise;
    }
}

export function createFetchRequest(createTimeout) {
    return function fetchRequest(url, options) {
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        if (controller) {
            options = Object.assign(options, {
                signal: controller.signal
            });
        }
        options = Object.assign(options, {
            mode: "cors",
            credentials: "omit",
            referrer: "no-referrer",
            cache: "no-cache",
        });
        if (options.headers) {
            const headers = new Headers();
            for(const [name, value] of options.headers.entries()) {
                headers.append(name, value);
            }
            options.headers = headers;
        }
        const promise = fetch(url, options).then(async response => {
            const {status} = response;
            const body = await response.json();
            return {status, body};
        }, err => {
            if (err.name === "AbortError") {
                throw new AbortError();
            } else if (err instanceof TypeError) {
                // Network errors are reported as TypeErrors, see
                // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#Checking_that_the_fetch_was_successful
                // this can either mean user is offline, server is offline, or a CORS error (server misconfiguration).
                // 
                // One could check navigator.onLine to rule out the first
                // but the 2 latter ones are indistinguishable from javascript.
                throw new ConnectionError(`${options.method} ${url}: ${err.message}`);
            }
            throw err;
        });
        const result = new RequestResult(promise, controller);

        if (options.timeout) {
            result.promise = abortOnTimeout(createTimeout, options.timeout, result, result.promise);
        }

        return result;
    }   
}
