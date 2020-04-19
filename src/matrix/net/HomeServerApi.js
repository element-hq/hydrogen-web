import {
    HomeServerError,
    ConnectionError,
} from "./error.js";

class RequestWrapper {
    constructor(method, url, requestResult) {
        this._requestResult = requestResult;
        this._promise = this._requestResult.response().then(response => {
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

export default class HomeServerApi {
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

    _request(method, url, queryParams = {}, body, options) {
        const queryString = Object.entries(queryParams)
            .filter(([, value]) => value !== undefined)
            .map(([name, value]) => {
                if (typeof value === "object") {
                    value = JSON.stringify(value);
                }
                return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
            })
            .join("&");
        url = `${url}?${queryString}`;
        let bodyString;
        const headers = new Headers();
        if (this._accessToken) {
            headers.append("Authorization", `Bearer ${this._accessToken}`);
        }
        headers.append("Accept", "application/json");
        if (body) {
            headers.append("Content-Type", "application/json");
            bodyString = JSON.stringify(body);
        }
        const requestResult = this._requestFn(url, {
            method,
            headers,
            body: bodyString,
        });

        if (options.timeout) {
            const timeout = this._createTimeout(options.timeout);
            // abort request if timeout finishes first
            timeout.elapsed().then(
                () => requestResult.abort(),
                () => {}    // ignore AbortError
            );
            // abort timeout if request finishes first
            requestResult.response().then(() => timeout.abort());
        }

        const wrapper = new RequestWrapper(method, url, requestResult);
        
        if (this._reconnector) {
            wrapper.response().catch(err => {
                if (err instanceof ConnectionError) {
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
        return this._request("GET", `${this._homeserver}/_matrix/client/versions`, null, options);
    }
}
