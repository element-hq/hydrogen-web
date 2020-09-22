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

import {HomeServerError} from "../error.js";
import {encodeQueryParams} from "./common.js";

class RequestWrapper {
    constructor(method, url, requestResult) {
        this._requestResult = requestResult;
        this._promise = requestResult.response().then(response => {
            // ok?
            if (response.status >= 200 && response.status < 300) {
                return response.body;
            } else {
                switch (response.status) {
                    default:
                        throw new HomeServerError(method, url, response.body, response.status);
                }
            }
        });
    }

    abort() {
        return this._requestResult.abort();
    }

    response() {
        return this._promise;
    }
}

export class HomeServerApi {
    constructor({homeServer, accessToken, request, createTimeout, reconnector}) {
        // store these both in a closure somehow so it's harder to get at in case of XSS?
        // one could change the homeserver as well so the token gets sent there, so both must be protected from read/write
        this._homeserver = homeServer;
        this._accessToken = accessToken;
        this._requestFn = request;
        this._createTimeout = createTimeout;
        this._reconnector = reconnector;
    }

    _url(csPath) {
        return `${this._homeserver}/_matrix/client/r0${csPath}`;
    }

    _baseRequest(method, url, queryParams, body, options, accessToken) {
        const queryString = encodeQueryParams(queryParams);
        url = `${url}?${queryString}`;
        let bodyString;
        const headers = new Map();
        if (accessToken) {
            headers.set("Authorization", `Bearer ${accessToken}`);
        }
        headers.set("Accept", "application/json");
        if (body) {
            headers.set("Content-Type", "application/json");
            bodyString = JSON.stringify(body);
        }
        const requestResult = this._requestFn(url, {
            method,
            headers,
            body: bodyString,
            timeout: options && options.timeout
        });

        const wrapper = new RequestWrapper(method, url, requestResult);
        
        if (this._reconnector) {
            wrapper.response().catch(err => {
                if (err.name === "ConnectionError") {
                    this._reconnector.onRequestFailed(this);
                }
            });
        }

        return wrapper;
    }

    _unauthedRequest(method, url, queryParams, body, options) {
        return this._baseRequest(method, url, queryParams, body, options, null);
    }

    _authedRequest(method, url, queryParams, body, options) {
        return this._baseRequest(method, url, queryParams, body, options, this._accessToken);
    }

    _post(csPath, queryParams, body, options) {
        return this._authedRequest("POST", this._url(csPath), queryParams, body, options);
    }

    _put(csPath, queryParams, body, options) {
        return this._authedRequest("PUT", this._url(csPath), queryParams, body, options);
    }

    _get(csPath, queryParams, body, options) {
        return this._authedRequest("GET", this._url(csPath), queryParams, body, options);
    }

    sync(since, filter, timeout, options = null) {
        return this._get("/sync", {since, timeout, filter}, null, options);
    }

    // params is from, dir and optionally to, limit, filter.
    messages(roomId, params, options = null) {
        return this._get(`/rooms/${encodeURIComponent(roomId)}/messages`, params, null, options);
    }

    // params is at, membership and not_membership
    members(roomId, params, options = null) {
        return this._get(`/rooms/${encodeURIComponent(roomId)}/members`, params, null, options);
    }

    send(roomId, eventType, txnId, content, options = null) {
        return this._put(`/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(eventType)}/${encodeURIComponent(txnId)}`, {}, content, options);
    }

    receipt(roomId, receiptType, eventId, options = null) {
        return this._post(`/rooms/${encodeURIComponent(roomId)}/receipt/${encodeURIComponent(receiptType)}/${encodeURIComponent(eventId)}`,
            {}, {}, options);
    }

    passwordLogin(username, password, initialDeviceDisplayName, options = null) {
        return this._unauthedRequest("POST", this._url("/login"), null, {
          "type": "m.login.password",
          "identifier": {
            "type": "m.id.user",
            "user": username
          },
          "password": password,
          "initial_device_display_name": initialDeviceDisplayName
        }, options);
    }

    createFilter(userId, filter, options = null) {
        return this._post(`/user/${encodeURIComponent(userId)}/filter`, null, filter, options);
    }

    versions(options = null) {
        return this._unauthedRequest("GET", `${this._homeserver}/_matrix/client/versions`, null, null, options);
    }

    uploadKeys(payload, options = null) {
        return this._post("/keys/upload", null, payload, options);
    }

    queryKeys(queryRequest, options = null) {
        return this._post("/keys/query", null, queryRequest, options);
    }

    claimKeys(payload, options = null) {
        return this._post("/keys/claim", null, payload, options);
    }

    sendToDevice(type, payload, txnId, options = null) {
        return this._put(`/sendToDevice/${encodeURIComponent(type)}/${encodeURIComponent(txnId)}`, null, payload, options);
    }
    
    roomKeysVersion(version = null, options = null) {
        let versionPart = "";
        if (version) {
            versionPart = `/${encodeURIComponent(version)}`;
        }
        return this._get(`/room_keys/version${versionPart}`, null, null, options);
    }

    roomKeyForRoomAndSession(version, roomId, sessionId, options = null) {
        return this._get(`/room_keys/keys/${encodeURIComponent(roomId)}/${encodeURIComponent(sessionId)}`, {version}, null, options);
    }
}

export function tests() {
    function createRequestMock(result) {
        return function() {
            return {
                abort() {},
                response() {
                    return Promise.resolve(result);
                }
            }
        }
    }

    return {
        "superficial happy path for GET": async assert => {
            const hsApi = new HomeServerApi({
                request: createRequestMock({body: 42, status: 200}),
                homeServer: "https://hs.tld"
            });
            const result = await hsApi._get("foo", null, null, null).response();
            assert.strictEqual(result, 42);
        }
    }
}
