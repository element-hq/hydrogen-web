import {
    HomeServerError,
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
    constructor({homeServer, accessToken, request}) {
        // store these both in a closure somehow so it's harder to get at in case of XSS?
        // one could change the homeserver as well so the token gets sent there, so both must be protected from read/write
        this._homeserver = homeServer;
        this._accessToken = accessToken;
        this._requestFn = request;
    }

    _url(csPath) {
        return `${this._homeserver}/_matrix/client/r0${csPath}`;
    }

    _request(method, url, queryParams = {}, body) {
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
        return new RequestWrapper(method, url, requestResult);
    }

    _post(csPath, queryParams, body) {
        return this._request("POST", this._url(csPath), queryParams, body);
    }

    _put(csPath, queryParams, body) {
        return this._request("PUT", this._url(csPath), queryParams, body);
    }

    _get(csPath, queryParams, body) {
        return this._request("GET", this._url(csPath), queryParams, body);
    }

    sync(since, filter, timeout) {
        return this._get("/sync", {since, timeout, filter});
    }

    // params is from, dir and optionally to, limit, filter.
    messages(roomId, params) {
        return this._get(`/rooms/${encodeURIComponent(roomId)}/messages`, params);
    }

    send(roomId, eventType, txnId, content) {
        return this._put(`/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(eventType)}/${encodeURIComponent(txnId)}`, {}, content);
    }

    passwordLogin(username, password) {
        return this._post("/login", undefined, {
          "type": "m.login.password",
          "identifier": {
            "type": "m.id.user",
            "user": username
          },
          "password": password
        });
    }

    createFilter(userId, filter) {
        return this._post(`/user/${encodeURIComponent(userId)}/filter`, undefined, filter);
    }

    versions(timeout) {
        // TODO: implement timeout
        return this._request("GET", `${this._homeserver}/_matrix/client/versions`);
    }
}
