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
import {HomeServerApi} from "./HomeServerApi";
import {ExponentialRetryDelay} from "./ExponentialRetryDelay";
import {Clock} from "../../platform/web/dom/Clock.js";
import type {IHomeServerRequest} from "./HomeServerRequest.js";

class Request implements IHomeServerRequest {
    public readonly methodName: string;
    public readonly args: any[];
    public resolve: (result: any) => void;
    public reject: (error: Error) => void;
    public requestResult?: IHomeServerRequest;
    private readonly _responsePromise: Promise<any>;

    constructor(methodName: string, args: any[]) {
        this.methodName = methodName;
        this.args = args;
        this._responsePromise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    abort(): void {
        if (this.requestResult) {
            this.requestResult.abort();
        } else {
            this.reject(new AbortError());
        }
    }

    response(): Promise<any> {
        return this._responsePromise;
    }
}

class HomeServerApiWrapper {
    private readonly _scheduler: RequestScheduler;

    constructor(scheduler: RequestScheduler) {
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
    private readonly _hsApi: HomeServerApi;
    private readonly _clock: Clock;
    private readonly _requests: Set<Request> = new Set();
    private _stopped = false;
    private _wrapper = new HomeServerApiWrapper(this);

    constructor({ hsApi, clock }: { hsApi: HomeServerApi; clock: Clock }) {
        this._hsApi = hsApi;
        this._clock = clock;
    }

    get hsApi(): HomeServerApi {
        return this._wrapper as unknown as HomeServerApi;
    }

    stop(): void {
        this._stopped = true;
        for (const request of this._requests) {
            request.abort();
        }
        this._requests.clear();
    }

    start(): void {
        this._stopped = false;
    }

    private _hsApiRequest(name: string, args: any[]): Request {
        const request = new Request(name, args);
        this._doSend(request);
        return request;
    }

    private async _doSend(request: Request): Promise<void> {
        this._requests.add(request);
        try {
            let retryDelay: ExponentialRetryDelay | undefined;
            while (!this._stopped) {
                try {
                    const requestResult = this._hsApi[
                        request.methodName
                    ].apply(this._hsApi, request.args);
                    // so the request can be aborted
                    request.requestResult = requestResult;
                    const response = await requestResult.response();
                    request.resolve(response);
                    return;
                } catch (err) {
                    if (
                        err instanceof HomeServerError &&
                        err.errcode === "M_LIMIT_EXCEEDED"
                    ) {
                        if (Number.isSafeInteger(err.retry_after_ms)) {
                            await this._clock
                                .createTimeout(err.retry_after_ms)
                                .elapsed();
                        } else {
                            if (!retryDelay) {
                                retryDelay = new ExponentialRetryDelay(
                                    this._clock.createTimeout
                                );
                            }
                            await retryDelay.waitForRetry();
                        }
                    } else {
                        request.reject(err);
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
