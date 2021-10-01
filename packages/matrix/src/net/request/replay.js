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

import {
    AbortError,
    ConnectionError
} from "../../error.js";

class RequestLogItem {
    constructor(url, options) {
        this.url = url;
        this.options = options;
        this.error = null;
        this.body = null;
        this.status = status;
        this.start = performance.now();
        this.end = 0;
    }

    async handleResponse(response) {
        this.end = performance.now();
        this.status = response.status;
        this.body = response.body;
    }

    handleError(err) {
        this.end = performance.now();
        this.error = {
            aborted: err instanceof AbortError,
            network: err instanceof ConnectionError,
            message: err.message,
        };
    }
}

export class RecordRequester {
    constructor(request) {
        this._origRequest = request;
        this._requestLog = [];
        this.request = this.request.bind(this);
    }

    request(url, options) {
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

    log() {
        return this._requestLog;
    }
}

export class ReplayRequester {
    constructor(log, options) {
        this._log = log.slice();
        this._options = options;
        this.request = this.request.bind(this);
    }

    request(url, options) {
        const idx = this._log.findIndex(item => {
            return item.url === url && options.method === item.options.method;
        });
        if (idx === -1) {
            return new ReplayRequestResult({status: 404}, options);
        } else {
            const [item] = this._log.splice(idx, 1);
            return new ReplayRequestResult(item, options);
        }
    }
}

class ReplayRequestResult {
    constructor(item, options) {
        this._item = item;
        this._options = options;
        this._aborted = false;
    }

    abort() {
        this._aborted = true;
    }

    async response() {
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
