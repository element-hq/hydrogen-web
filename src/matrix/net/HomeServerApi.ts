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

import {encodeQueryParams, encodeBody} from "./common";
import {HomeServerRequest} from "./HomeServerRequest";
import type {Reconnector} from "./Reconnector";
import type {IEncodedBody} from "./common";
import type {IRequestOptions, RequestFunction} from "../../platform/types/Platform";
import type {LogItem} from "../../logging/LogItem";

type RequestMethod = "POST" | "GET" | "PUT";

const CS_R0_PREFIX = "/_matrix/client/r0";
const DEHYDRATION_PREFIX = "/_matrix/client/unstable/org.matrix.msc2697.v2";

export class HomeServerApi {
    private readonly _homeserver: string;
    private readonly _accessToken: string;
    private readonly _requestFn: RequestFunction;
    private readonly _reconnector: Reconnector;

    constructor({homeserver, accessToken, request, reconnector}: {homeserver: string, accessToken: string, request: RequestFunction, reconnector: Reconnector}) {
        // store these both in a closure somehow so it's harder to get at in case of XSS?
        // one could change the homeserver as well so the token gets sent there, so both must be protected from read/write
        this._homeserver = homeserver;
        this._accessToken = accessToken;
        this._requestFn = request;
        this._reconnector = reconnector;
    }

    private _url(csPath: string, prefix: string = CS_R0_PREFIX): string {
        return this._homeserver + prefix + csPath;
    }

    private _baseRequest(method: RequestMethod, url: string, queryParams?: Record<string, any>, body?: Record<string, any>, options?: IRequestOptions, accessToken?: string): HomeServerRequest {
        const queryString = encodeQueryParams(queryParams);
        url = `${url}?${queryString}`;
        let log: LogItem | undefined;
        if (options?.log) {
            const parent = options?.log;
            log = parent.child({
                t: "network",
                url,
                method,
            }, parent.level.Info);
        }
        let encodedBody: IEncodedBody["body"];
        const headers: Map<string, string | number> = new Map();
        if (accessToken) {
            headers.set("Authorization", `Bearer ${accessToken}`);
        }
        headers.set("Accept", "application/json");
        if (body) {
            const encoded = encodeBody(body);
            headers.set("Content-Type", encoded.mimeType);
            //todo: remove this?
            headers.set("Content-Length", encoded.length);
            encodedBody = encoded.body;
        }

        const requestResult = this._requestFn(url, {
            method,
            headers,
            body: encodedBody,
            timeout: options?.timeout,
            uploadProgress: options?.uploadProgress,
            format: "json"  // response format
        });

        const hsRequest = new HomeServerRequest(method, url, requestResult, log);
        
        if (this._reconnector) {
            hsRequest.response().catch(err => {
                // Some endpoints such as /sync legitimately time-out
                // (which is also reported as a ConnectionError) and will re-attempt,
                // but spinning up the reconnector in this case is ok,
                // as all code ran on session and sync start should be reentrant
                if (err.name === "ConnectionError") {
                    this._reconnector.onRequestFailed(this);
                }
            });
        }

        return hsRequest;
    }

    private _unauthedRequest(method: RequestMethod, url: string, queryParams?: Record<string, any>, body?: Record<string, any>, options?: IRequestOptions): HomeServerRequest {
        return this._baseRequest(method, url, queryParams, body, options);
    }

    private _authedRequest(method: RequestMethod, url: string, queryParams?: Record<string, any>, body?: Record<string, any>, options?: IRequestOptions): HomeServerRequest {
        return this._baseRequest(method, url, queryParams, body, options, this._accessToken);
    }

    private _post(csPath: string, queryParams: Record<string, any>, body: Record<string, any>, options?: IRequestOptions): HomeServerRequest {
        return this._authedRequest("POST", this._url(csPath, options?.prefix || CS_R0_PREFIX), queryParams, body, options);
    }

    private _put(csPath: string, queryParams: Record<string, any>, body?: Record<string, any>, options?: IRequestOptions): HomeServerRequest {
        return this._authedRequest("PUT", this._url(csPath, options?.prefix || CS_R0_PREFIX), queryParams, body, options);
    }

    private _get(csPath: string, queryParams?: Record<string, any>, body?: Record<string, any>, options?: IRequestOptions): HomeServerRequest {
        return this._authedRequest("GET", this._url(csPath, options?.prefix || CS_R0_PREFIX), queryParams, body, options);
    }

    sync(since: string, filter: string, timeout: number, options?: IRequestOptions): HomeServerRequest {
        return this._get("/sync", {since, timeout, filter}, undefined, options);
    }

    // params is from, dir and optionally to, limit, filter.
    messages(roomId: string, params: Record<string, any>, options?: IRequestOptions): HomeServerRequest {
        return this._get(`/rooms/${encodeURIComponent(roomId)}/messages`, params, undefined, options);
    }

    // params is at, membership and not_membership
    members(roomId: string, params: Record<string, any>, options?: IRequestOptions): HomeServerRequest {
        return this._get(`/rooms/${encodeURIComponent(roomId)}/members`, params, undefined, options);
    }

    send(roomId: string, eventType: string, txnId: string, content: Record<string, any>, options?: IRequestOptions): HomeServerRequest {
        return this._put(`/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(eventType)}/${encodeURIComponent(txnId)}`, {}, content, options);
    }

    redact(roomId: string, eventId: string, txnId: string, content: Record<string, any>, options?: IRequestOptions): HomeServerRequest {
        return this._put(`/rooms/${encodeURIComponent(roomId)}/redact/${encodeURIComponent(eventId)}/${encodeURIComponent(txnId)}`, {}, content, options);
    }

    receipt(roomId: string, receiptType: string, eventId: string, options?: IRequestOptions): HomeServerRequest {
        return this._post(`/rooms/${encodeURIComponent(roomId)}/receipt/${encodeURIComponent(receiptType)}/${encodeURIComponent(eventId)}`,
            {}, {}, options);
    }

    state(roomId: string, eventType: string, stateKey: string, options?: IRequestOptions): HomeServerRequest {
        return this._get(`/rooms/${encodeURIComponent(roomId)}/state/${encodeURIComponent(eventType)}/${encodeURIComponent(stateKey)}`, {}, undefined, options);
    }

    getLoginFlows(): HomeServerRequest {
        return this._unauthedRequest("GET", this._url("/login"));
    }

    passwordLogin(username: string, password: string, initialDeviceDisplayName: string, options?: IRequestOptions): HomeServerRequest {
        return this._unauthedRequest("POST", this._url("/login"), undefined, {
          "type": "m.login.password",
          "identifier": {
            "type": "m.id.user",
            "user": username
          },
          "password": password,
          "initial_device_display_name": initialDeviceDisplayName
        }, options);
    }

    tokenLogin(loginToken: string, txnId: string, initialDeviceDisplayName: string, options?: IRequestOptions): HomeServerRequest {
        return this._unauthedRequest("POST", this._url("/login"), undefined, {
          "type": "m.login.token",
          "identifier": {
            "type": "m.id.user",
          },
          "token": loginToken,
          "txn_id": txnId,
          "initial_device_display_name": initialDeviceDisplayName
        }, options);
    }

    createFilter(userId: string, filter: Record<string, any>, options?: IRequestOptions): HomeServerRequest {
        return this._post(`/user/${encodeURIComponent(userId)}/filter`, {}, filter, options);
    }

    versions(options?: IRequestOptions): HomeServerRequest {
        return this._unauthedRequest("GET", `${this._homeserver}/_matrix/client/versions`, undefined, undefined, options);
    }

    uploadKeys(dehydratedDeviceId: string, payload: Record<string, any>, options?: IRequestOptions): HomeServerRequest {
        let path = "/keys/upload";
        if (dehydratedDeviceId) {
            path = path + `/${encodeURIComponent(dehydratedDeviceId)}`;
        }
        return this._post(path, {}, payload, options);
    }

    queryKeys(queryRequest: Record<string, any>, options?: IRequestOptions): HomeServerRequest {
        return this._post("/keys/query", {}, queryRequest, options);
    }

    claimKeys(payload: Record<string, any>, options?: IRequestOptions): HomeServerRequest {
        return this._post("/keys/claim", {}, payload, options);
    }

    sendToDevice(type: string, payload: Record<string, any>, txnId: string, options?: IRequestOptions): HomeServerRequest {
        return this._put(`/sendToDevice/${encodeURIComponent(type)}/${encodeURIComponent(txnId)}`, {}, payload, options);
    }
    
    roomKeysVersion(version?: string, options?: IRequestOptions): HomeServerRequest {
        let versionPart = "";
        if (version) {
            versionPart = `/${encodeURIComponent(version)}`;
        }
        return this._get(`/room_keys/version${versionPart}`, undefined, undefined, options);
    }

    roomKeyForRoomAndSession(version: string, roomId: string, sessionId: string, options?: IRequestOptions): HomeServerRequest {
        return this._get(`/room_keys/keys/${encodeURIComponent(roomId)}/${encodeURIComponent(sessionId)}`, {version}, undefined, options);
    }

    uploadAttachment(blob: Blob, filename: string, options?: IRequestOptions): HomeServerRequest {
        return this._authedRequest("POST", `${this._homeserver}/_matrix/media/r0/upload`, {filename}, blob, options);
    }

    setPusher(pusher: Record<string, any>, options?: IRequestOptions): HomeServerRequest {
        return this._post("/pushers/set", {}, pusher, options);
    }

    getPushers(options?: IRequestOptions): HomeServerRequest {
        return this._get("/pushers", undefined, undefined, options);
    }

    join(roomId: string, options?: IRequestOptions): HomeServerRequest {
        return this._post(`/rooms/${encodeURIComponent(roomId)}/join`, {}, {}, options);
    }

    joinIdOrAlias(roomIdOrAlias: string, options?: IRequestOptions): HomeServerRequest {
        return this._post(`/join/${encodeURIComponent(roomIdOrAlias)}`, {}, {}, options);
    }

    leave(roomId: string, options?: IRequestOptions): HomeServerRequest {
        return this._post(`/rooms/${encodeURIComponent(roomId)}/leave`, {}, {}, options);
    }

    forget(roomId: string, options?: IRequestOptions): HomeServerRequest {
        return this._post(`/rooms/${encodeURIComponent(roomId)}/forget`, {}, {}, options);
    }

    logout(options?: IRequestOptions): HomeServerRequest {
        return this._post(`/logout`, {}, {}, options);
    }

    getDehydratedDevice(options: IRequestOptions): HomeServerRequest {
        options.prefix = DEHYDRATION_PREFIX;
        return this._get(`/dehydrated_device`, undefined, undefined, options);
    }

    createDehydratedDevice(payload: Record<string, any>, options: IRequestOptions): HomeServerRequest {
        options.prefix = DEHYDRATION_PREFIX;
        return this._put(`/dehydrated_device`, {}, payload, options);
    }

    claimDehydratedDevice(deviceId: string, options: IRequestOptions): HomeServerRequest {
        options.prefix = DEHYDRATION_PREFIX;
        return this._post(`/dehydrated_device/claim`, {}, {device_id: deviceId}, options);
    }
}

import {Request as MockRequest} from "../../mocks/Request.js";

export function tests() {
    return {
        "superficial happy path for GET": async assert => {
            // @ts-ignore
            const hsApi = new HomeServerApi({
                request: () => new MockRequest().respond(200, 42),
                homeserver: "https://hs.tld",
            });
            // @ts-ignore
            const result = await hsApi._get("foo", undefined, undefined, undefined).response();
            assert.strictEqual(result, 42);
        }
    }
}
