/*
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

import {AbortError} from "../../../utils/error";

class WorkerState {
    constructor(worker) {
        this.worker = worker;
        this.busy = false;
    }

    attach(pool) {
        this.worker.addEventListener("message", pool);
        this.worker.addEventListener("error", pool);
    }

    detach(pool) {
        this.worker.removeEventListener("message", pool);
        this.worker.removeEventListener("error", pool);
    }
}

class Request {
    constructor(message, pool) {
        this._promise = new Promise((_resolve, _reject) => {
            this._resolve = _resolve;
            this._reject = _reject;
        });
        this._message = message;
        this._pool = pool;
        this._worker = null;
    }

    abort() {
        if (this._isNotDisposed) {
            this._pool._abortRequest(this);
            this._dispose();
        }
    }

    response() {
        return this._promise;
    }

    _dispose() {
        this._reject = null;
        this._resolve = null;
    }

    get _isNotDisposed() {
        return this._resolve && this._reject;
    }
}

export class WorkerPool {
    // TODO: extract DOM specific bits and write unit tests
    constructor(path, amount) {
        this._workers = [];
        for (let i = 0; i < amount ; ++i) {
            const worker = new WorkerState(new Worker(path));
            worker.attach(this);
            this._workers[i] = worker;
        }
        this._requests = new Map();
        this._counter = 0;
        this._pendingFlag = false;
        this._init = null;

    }

    init() {
        const promise = new Promise((resolve, reject) => {
            this._init = {resolve, reject};
        });
        this.sendAll({type: "ping"})
            .then(this._init.resolve, this._init.reject)
            .finally(() => {
                this._init = null;
            });
        return promise;
    }

    handleEvent(e) {
        if (e.type === "message") {
            const message = e.data;
            const request = this._requests.get(message.replyToId);
            if (request) {
                request._worker.busy = false;
                if (request._isNotDisposed) {
                    if (message.type === "success") {
                        request._resolve(message.payload);
                    } else if (message.type === "error") {
                        const err = new Error(message.message);
                        err.stack = message.stack;
                        request._reject(err);
                    }
                    request._dispose();
                }
                this._requests.delete(message.replyToId);
            }
            this._sendPending();
        } else if (e.type === "error") {
            if (this._init) {
                this._init.reject(new Error("worker error during init"));
            }
            console.error("worker error", e);
        }
    }

    _getPendingRequest() {
        for (const r of this._requests.values()) {
            if (!r._worker) {
                return r;
            }
        }
    }

    _getFreeWorker() {
        for (const w of this._workers) {
            if (!w.busy) {
                return w;
            }
        }
    }

    _sendPending() {
        this._pendingFlag = false;
        let success;
        do {
            success = false;
            const request = this._getPendingRequest();
            if (request) {
                const worker = this._getFreeWorker();
                if (worker) {
                    this._sendWith(request, worker);
                    success = true;
                }
            }
        } while (success);
    }

    _sendWith(request, worker) {
        request._worker = worker;
        worker.busy = true;
        worker.worker.postMessage(request._message);
    }

    _enqueueRequest(message) {
        this._counter += 1;
        message.id = this._counter;
        const request = new Request(message, this);
        this._requests.set(message.id, request);
        return request;
    }

    send(message) {
        const request = this._enqueueRequest(message);
        const worker = this._getFreeWorker();
        if (worker) {
            this._sendWith(request, worker);
        }
        return request;
    }

    // assumes all workers are free atm
    sendAll(message) {
        const promises = this._workers.map(worker => {
            const request = this._enqueueRequest(Object.assign({}, message));
            this._sendWith(request, worker);
            return request.response();
        });
        return Promise.all(promises);
    }

    dispose() {
        for (const w of this._workers) {
            w.detach(this);
            w.worker.terminate();
        }
    }

    _trySendPendingInNextTick() {
        if (!this._pendingFlag) {
            this._pendingFlag = true;
            Promise.resolve().then(() => {
                this._sendPending();
            });
        }
    }

    _abortRequest(request) {
        request._reject(new AbortError());
        if (request._worker) {
            request._worker.busy = false;
        }
        this._requests.delete(request._message.id);
        // allow more requests to be aborted before trying to send other pending
        this._trySendPendingInNextTick();
    }
}
