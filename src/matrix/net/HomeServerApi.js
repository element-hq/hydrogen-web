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
    HomeServerError,
    ConnectionError,
    AbortError
} from "../error.js";

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

    _encodeQueryParams(queryParams) {
        return Object.entries(queryParams || {})
            .filter(([, value]) => value !== undefined)
            .map(([name, value]) => {
                if (typeof value === "object") {
                    value = JSON.stringify(value);
                }
                return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
            })
            .join("&");
    }

    _request(method, url, queryParams, body, options) {
        const queryString = this._encodeQueryParams(queryParams);
        url = `${url}?${queryString}`;
        let bodyString;
        const headers = new Map();
        if (this._accessToken) {
            headers.set("Authorization", `Bearer ${this._accessToken}`);
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

    _post(csPath, queryParams, body, options) {
        return this._request("POST", this._url(csPath), queryParams, body, options);
    }

    _put(csPath, queryParams, body, options) {
        return this._request("PUT", this._url(csPath), queryParams, body, options);
    }

    _get(csPath, queryParams, body, options) {
        return this._request("GET", this._url(csPath), queryParams, body, options);
    }

    sync(since, filter, timeout, options = null) {
        return this._get("/sync", {since, timeout, filter}, null, options);
    }

    // params is from, dir and optionally to, limit, filter.
    messages(roomId, params, options = null) {
        return this._get(`/rooms/${encodeURIComponent(roomId)}/messages`, params, null, options);
    }

    send(roomId, eventType, txnId, content, options = null) {
        return this._put(`/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(eventType)}/${encodeURIComponent(txnId)}`, {}, content, options);
    }

    passwordLogin(username, password, options = null) {
        return this._post("/login", null, {
          "type": "m.login.password",
          "identifier": {
            "type": "m.id.user",
            "user": username
          },
          "password": password
        }, options);
    }

    createFilter(userId, filter, options = null) {
        return this._post(`/user/${encodeURIComponent(userId)}/filter`, null, filter, options);
    }

    versions(options = null) {
        return this._request("GET", `${this._homeserver}/_matrix/client/versions`, null, null, options);
    }

    _parseMxcUrl(url) {
        const prefix = "mxc://";
        if (url.startsWith(prefix)) {
            return url.substr(prefix.length).split("/", 2);
        } else {
            return null;
        }
    }

    mxcUrlThumbnail(url, width, height, method) {
        const parts = this._parseMxcUrl(url);
        if (parts) {
            const [serverName, mediaId] = parts;
            const httpUrl = `${this._homeserver}/_matrix/media/r0/thumbnail/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`;
            return httpUrl + "?" + this._encodeQueryParams({width, height, method});
        }
        return null;
    }

    mxcUrl(url) {
        const parts = this._parseMxcUrl(url);
        if (parts) {
            const [serverName, mediaId] = parts;
            return `${this._homeserver}/_matrix/media/r0/download/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`;
        } else {
            return null;
        }
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
