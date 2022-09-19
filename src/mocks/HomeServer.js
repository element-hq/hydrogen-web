/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {BaseRequest} from "./Request";

// a request as returned by the HomeServerApi
class HomeServerRequest extends BaseRequest {
    constructor(args) {
        super();
        this.arguments = args;
    }

    respond(body) {
        return this._respond(body);
    }
}

class Target {
    constructor() {
        this.requests = {};
    }
}

function handleMethod(target, name, ...args) {
    let requests = target.requests[name]
    if (!requests) {
        target.requests[name] = requests = [];
    }
    const request = new HomeServerRequest(args);
    requests.push(request);
    return request;
}

class Handler {
    get(target, prop) {
        return handleMethod.bind(null, target, prop);
    }
}

export class HomeServer {
    constructor() {
        this._target = new Target();
        this.api = new Proxy(this._target, new Handler());
    }

    get requests() {
        return this._target.requests;
    }
}