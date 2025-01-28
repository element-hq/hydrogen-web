/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseRequest} from "./Request.js";

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