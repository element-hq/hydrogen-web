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

import {AbortError} from "../utils/error";

export class BaseRequest {
    constructor() {
        this._responsePromise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
        this.responded = false;
        this.aborted = false;
    }

    _respond(value) {
        this.responded = true;
        this.resolve(value);
        return this;
    }

    abort() {
        this.aborted = true;
        this.reject(new AbortError());
    }

    response() {
        return this._responsePromise;
    }
}

// this is a NetworkRequest as used by HomeServerApi
export class Request extends BaseRequest {
    respond(status, body) {
        return this._respond({status, body});
    }
}
