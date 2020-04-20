import {
    AbortError,
    ConnectionError
} from "../../error.js";

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
            this._promise = Promise.race([promise, abortPromise]);
        } else {
            this._promise = promise;
            this._controller = controller;
        }
    }

    abort() {
        this._controller.abort();
    }

    response() {
        return this._promise;
    }
}

export default function fetchRequest(url, options) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    if (controller) {
        options = Object.assign(options, {
            signal: controller.signal
        });
    }
    options = Object.assign(options, {
        mode: "cors",
        credentials: "omit",
        referrer: "no-referrer",
        cache: "no-cache",
    });
    const promise = fetch(url, options).then(async response => {
        const {status} = response;
        const body = await response.json();
        return {status, body};
    }, err => {
        if (err.name === "AbortError") {
            throw new AbortError();
        } else if (err instanceof TypeError) {
            // Network errors are reported as TypeErrors, see
            // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#Checking_that_the_fetch_was_successful
            // this can either mean user is offline, server is offline, or a CORS error (server misconfiguration).
            // 
            // One could check navigator.onLine to rule out the first
            // but the 2 latter ones are indistinguishable from javascript.
            throw new ConnectionError(`${options.method} ${url}: ${err.message}`);
        }
        throw err;
    });
    return new RequestResult(promise, controller);
}
