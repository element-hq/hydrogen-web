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

import {
    AbortError,
    ConnectionError
} from "../../../../matrix/error.js";
import {abortOnTimeout} from "../../../../utils/timeout";
import {addCacheBuster, mapAsFormData} from "./common.js";
import {xhrRequest} from "./xhr.js";

class RequestResult {
    constructor(promise, controller) {
        if (!controller) {
            const abortPromise = new Promise((_, reject) => {
                this._controller = {
                    abort() {
                        const err = new Error("fetch request aborted");
                        err.name = "AbortError";
                        reject(err);
                    }
                };
            });
            this.promise = Promise.race([promise, abortPromise]);
        } else {
            this.promise = promise;
            this._controller = controller;
        }
    }

    abort() {
        this._controller.abort();
    }

    response() {
        return this.promise;
    }
}

export function createFetchRequest(createTimeout, serviceWorkerHandler) {
    return function fetchRequest(url, requestOptions) {
        if (serviceWorkerHandler?.haltRequests) {
            // prevent any requests while waiting
            // for the new service worker to get activated.
            // Once this happens, the page will be reloaded
            // by the serviceWorkerHandler so this is fine.
            return new RequestResult(new Promise(() => {}), {});
        }
        // fetch doesn't do upload progress yet, delegate to xhr
        if (requestOptions?.uploadProgress) {
            return xhrRequest(url, requestOptions);
        }
        let {method, headers, body, timeout, format, cache = false} = requestOptions;
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        // if a BlobHandle, take native blob
        if (body?.nativeBlob) {
            body = body.nativeBlob;
        }
        if (body instanceof Map) {
            body = mapAsFormData(body);
        }
        let options = {method, body};
        if (controller) {
            options = Object.assign(options, {
                signal: controller.signal
            });
        }
        if (!cache) {
            url = addCacheBuster(url);
        }
        options = Object.assign(options, {
            mode: "cors",
            credentials: "omit",
            referrer: "no-referrer",
            // ideally we'd turn off cache here, but Safari interprets
            // `Access-Control-Allow-Headers` strictly (only when fetch is
            // intercepted by a service worker strangely enough), in that
            // it gives a CORS error if Cache-Control is not present
            // in the list of allowed headers (which it isn't commonly, at least not on matrix.org).
            // With no-store or no-cache here, it does set `Cache-Control`
            // so we don't do that, and prevent caching with `addCacheBuster`.
            // We also hope the server responds with `Cache-Control: no-store` so
            // we don't fill the http cache with api responses.
            // 
            // cache: "no-store",
            cache: "default",
        });
        if (headers) {
            const fetchHeaders = new Headers();
            for(const [name, value] of headers.entries()) {
                fetchHeaders.append(name, value);
            }
            options.headers = fetchHeaders;
        }
        const promise = fetch(url, options).then(async response => {
            const {status} = response;
            let body;
            try {
                if (format === "json") {
                    body = await response.json();
                } else if (format === "buffer") {
                    body = await response.arrayBuffer();
                }
                else if (format === "text") {
                    body = await response.text();
                }
            } catch (err) {
                // some error pages return html instead of json, ignore error
                // detect these ignored errors from the response status 
                if (!(err.name === "SyntaxError" && status >= 400)) {
                    throw err;
                }
            }
            return {status, body};
        }, err => {
            if (err.name === "AbortError") {
                // map DOMException with name AbortError to our own AbortError type
                // as we don't want DOMExceptions in the protocol layer.
                throw new AbortError();
            } else if (err instanceof TypeError) {
                // Network errors are reported as TypeErrors, see
                // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#Checking_that_the_fetch_was_successful
                // this can either mean user is offline, server is offline, or a CORS error (server misconfiguration).
                // 
                // One could check navigator.onLine to rule out the first
                // but the 2 latter ones are indistinguishable from javascript.
                throw new ConnectionError(`${method} ${url}: ${err.message}`);
            }
            throw err;
        });
        const result = new RequestResult(promise, controller);

        if (timeout) {
            result.promise = abortOnTimeout(createTimeout, timeout, result, result.promise);
        }

        return result;
    }   
}
