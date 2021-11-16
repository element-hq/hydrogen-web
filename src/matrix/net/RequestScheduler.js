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

import {AbortError} from "../../utils/error";
import {HomeServerError} from "../error.js";
import {HomeServerApi} from "./HomeServerApi.js";
import {ExponentialRetryDelay} from "./ExponentialRetryDelay.js";

class Request {
    constructor(methodName, args) {
        this._methodName = methodName;
        this._args = args;
        this._responsePromise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
        this._requestResult = null;
    }

    abort() {
        if (this._requestResult) {
            this._requestResult.abort();
        } else {
            this._reject(new AbortError());
        }
    }

    response() {
        return this._responsePromise;
    }
}

class HomeServerApiWrapper {
    constructor(scheduler) {
        this._scheduler = scheduler;
    }
}

// add request-wrapping methods to prototype
for (const methodName of Object.getOwnPropertyNames(HomeServerApi.prototype)) {
    if (methodName !== "constructor" && !methodName.startsWith("_")) {
        HomeServerApiWrapper.prototype[methodName] = function(...args) {
            return this._scheduler._hsApiRequest(methodName, args);
        };
    }
}

export class RequestScheduler {
    constructor({hsApi, clock}) {
        this._hsApi = hsApi;
        this._clock = clock;
        this._requests = new Set();
        this._isRateLimited = false;
        this._isDrainingRateLimit = false;
        this._stopped = true;
        this._wrapper = new HomeServerApiWrapper(this);
    }

    get hsApi() {
        return this._wrapper;
    }

    stop() {
        this._stopped = true;
        for (const request of this._requests) {
            request.abort();
        }
        this._requests.clear();
    }

    start() {
        this._stopped = false;
    }

    _hsApiRequest(name, args) {
        const request = new Request(name, args);
        this._doSend(request);
        return request;
    }

    async _doSend(request) {
        this._requests.add(request);
        try {
            let retryDelay;
            while (!this._stopped) {
                try {
                    const requestResult = this._hsApi[request._methodName].apply(this._hsApi, request._args);
                    // so the request can be aborted
                    request._requestResult = requestResult;
                    const response = await requestResult.response();
                    request._resolve(response);
                    return;
                } catch (err) {
                    if (err instanceof HomeServerError && err.errcode === "M_LIMIT_EXCEEDED") {
                        if (Number.isSafeInteger(err.retry_after_ms)) {
                            await this._clock.createTimeout(err.retry_after_ms).elapsed();
                        } else {
                            if (!retryDelay) {
                                retryDelay = new ExponentialRetryDelay(this._clock.createTimeout);
                            }
                            await retryDelay.waitForRetry();
                        }
                    } else {
                        request._reject(err);
                        return;
                    }
                }
            }
            if (this._stopped) {
                request.abort();
            }
        } finally {
            this._requests.delete(request);
        }
    }
}
