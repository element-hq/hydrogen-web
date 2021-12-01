/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {AbortError, ConnectionError} from "../../error.js";
import type {IRequestOptions, RequestFunction} from "../../../platform/types/types";
import type {RequestResult} from "../../../platform/web/dom/request/fetch.js";

type Options = IRequestOptions & {
    method?: any;
    delay?: boolean;
}

class RequestLogItem {
    public readonly url: string;
    public readonly options: Options;
    public error: {aborted: boolean, network: boolean, message: string};
    public status: number;
    public body: Response["body"];
    public start: number = performance.now();
    public end: number = 0;

    constructor(url: string, options: Options) {
        this.url = url;
        this.options = options;
    }

    async handleResponse(response: Response) {
        this.end = performance.now();
        this.status = response.status;
        this.body = response.body;
    }

    handleError(err: Error): void {
        this.end = performance.now();
        this.error = {
            aborted: err instanceof AbortError,
            network: err instanceof ConnectionError,
            message: err.message,
        };
    }
}

export class RecordRequester {
    private readonly _origRequest: RequestFunction;
    private readonly _requestLog: RequestLogItem[] = [];

    constructor(request: RequestFunction) {
        this._origRequest = request;
        this.request = this.request.bind(this);
    }

    request(url: string, options: Options): RequestResult {
        const requestItem = new RequestLogItem(url, options);
        this._requestLog.push(requestItem);
        try {
            const requestResult = this._origRequest(url, options);
            requestResult.response().then(response => {
                requestItem.handleResponse(response);
            });
            return requestResult;
        } catch (err) {
            requestItem.handleError(err);
            throw err;
        }
    }

    log(): RequestLogItem[] {
        return this._requestLog;
    }
}

export class ReplayRequester {
    private readonly _log: RequestLogItem[];
    private readonly _options: Options;

    constructor(log: RequestLogItem[], options: Options) {
        this._log = log.slice();
        this._options = options;
        this.request = this.request.bind(this);
    }

    request(url: string, options: Options): ReplayRequestResult {
        const idx = this._log.findIndex((item) => {
            return item.url === url && options.method === item.options.method;
        });
        if (idx === -1) {
            return new ReplayRequestResult({ status: 404 } as RequestLogItem, options);
        } else {
            const [item] = this._log.splice(idx, 1);
            return new ReplayRequestResult(item, options);
        }
    }
}

class ReplayRequestResult {
    private readonly _item: RequestLogItem;
    private readonly _options: Options;
    private _aborted: boolean;

    constructor(item: RequestLogItem, options: Options) {
        this._item = item;
        this._options = options;
        this._aborted = false;
    }

    abort(): void {
        this._aborted = true;
    }

    async response(): Promise<RequestLogItem> {
        if (this._options.delay) {
            const delay = this._item.end - this._item.start;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        if (this._item.error || this._aborted) {
            const error = this._item.error;
            if (error.aborted || this._aborted) {
                throw new AbortError(error.message);
            } else if (error.network) {
                throw new ConnectionError(error.message);
            } else {
                throw new Error(error.message);
            }
        }
        return this._item;
    }
}
