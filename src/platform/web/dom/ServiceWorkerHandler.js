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

// 3 (imaginary) interfaces are implemented here:
// - OfflineAvailability (done by registering the sw)
// - UpdateService (see checkForUpdate method, and should also emit events rather than showing confirm dialog here)
// - ConcurrentAccessBlocker (see preventConcurrentSessionAccess method)
export class ServiceWorkerHandler {
    constructor() {
        this._waitingForReply = new Map();
        this._messageIdCounter = 0;
        this._navigation = null;
        this._registration = null;
        this._registrationPromise = null;
        this._currentController = null;
        this.haltRequests = false;
    }

    setNavigation(navigation) {
        this._navigation = navigation;
    }

    registerAndStart(path) {
        this._registrationPromise = (async () => {
            navigator.serviceWorker.addEventListener("message", this);
            navigator.serviceWorker.addEventListener("controllerchange", this);
            this._registration = await navigator.serviceWorker.register(path);
            await navigator.serviceWorker.ready;
            this._currentController = navigator.serviceWorker.controller;
            this._registration.addEventListener("updatefound", this);
            this._registrationPromise = null;
            // do we have a new service worker waiting to activate?
            if (this._registration.waiting && this._registration.active) {
                this._proposeUpdate();
            }
            console.log("Service Worker registered");
        })();
    }

    _onMessage(event) {
        const {data} = event;
        const replyTo = data.replyTo;
        if (replyTo) {
            const resolve = this._waitingForReply.get(replyTo);
            if (resolve) {
                this._waitingForReply.delete(replyTo);
                resolve(data.payload);
            }
        }
        if (data.type === "hasSessionOpen") {
            const hasOpen = this._navigation.observe("session").get() === data.payload.sessionId;
            event.source.postMessage({replyTo: data.id, payload: hasOpen});
        } else if (data.type === "hasRoomOpen") {
            const hasSessionOpen = this._navigation.observe("session").get() === data.payload.sessionId;
            const hasRoomOpen = this._navigation.observe("room").get() === data.payload.roomId;
            event.source.postMessage({replyTo: data.id, payload: hasSessionOpen && hasRoomOpen});
        } else if (data.type === "closeSession") {
            const {sessionId} = data.payload;
            this._closeSessionIfNeeded(sessionId).finally(() => {
                event.source.postMessage({replyTo: data.id});
            });
        } else if (data.type === "haltRequests") {
            // this flag is read in fetch.js
            this.haltRequests = true;
            event.source.postMessage({replyTo: data.id});
        } else if (data.type === "openRoom") {
            this._navigation.push("room", data.payload.roomId);
        }
    }

    _closeSessionIfNeeded(sessionId) {
        const currentSession = this._navigation?.path.get("session");
        if (sessionId && currentSession?.value === sessionId) {
            return new Promise(resolve => {
                const unsubscribe = this._navigation.pathObservable.subscribe(path => {
                    const session = path.get("session");
                    if (!session || session.value !== sessionId) {
                        unsubscribe();
                        resolve();
                    }
                });
                this._navigation.push("session");
            });
        } else {
            return Promise.resolve();
        }
    }

    async _proposeUpdate() {
        if (document.hidden) {
            return;
        }
        const version = await this._sendAndWaitForReply("version", null, this._registration.waiting);
        if (confirm(`Version ${version.version} (${version.buildHash}) is available. Reload to apply?`)) {
            // prevent any fetch requests from going to the service worker
            // from any client, so that it is not kept active
            // when calling skipWaiting on the new one
            await this._sendAndWaitForReply("haltRequests");
            // only once all requests are blocked, ask the new
            // service worker to skipWaiting
            this._send("skipWaiting", null, this._registration.waiting);
        }
    }

    handleEvent(event) {
        switch (event.type) {
            case "message":
                this._onMessage(event);
                break;
            case "updatefound":
                this._registration.installing.addEventListener("statechange", this);
                break;
            case "statechange": {
                if (event.target.state === "installed") {
                    this._proposeUpdate();
                    event.target.removeEventListener("statechange", this);
                }
                break;
            }
            case "controllerchange":
                if (!this._currentController) {
                    // Clients.claim() in the SW can trigger a controllerchange event
                    // if we had no SW before. This is fine,
                    // and now our requests will be served from the SW.
                    this._currentController = navigator.serviceWorker.controller;
                } else {
                    // active service worker changed,
                    // refresh, so we can get all assets 
                    // (and not only some if we would not refresh)
                    // up to date from it
                    document.location.reload();
                }
                break;
        }
    }

    async _send(type, payload, worker = undefined) {
        if (this._registrationPromise) {
            await this._registrationPromise;
        }
        if (!worker) {
            worker = this._registration.active;
        }
        worker.postMessage({type, payload});
    }

    async _sendAndWaitForReply(type, payload, worker = undefined) {
        if (this._registrationPromise) {
            await this._registrationPromise;
        }
        if (!worker) {
            worker = this._registration.active;
        }
        this._messageIdCounter += 1;
        const id = this._messageIdCounter;
        const promise = new Promise(resolve => {
            this._waitingForReply.set(id, resolve);
        });
        worker.postMessage({type, id, payload});
        return await promise;
    }

    async checkForUpdate() {
        if (this._registrationPromise) {
            await this._registrationPromise;
        }
        this._registration.update();
    }

    get version() {
        return DEFINE_VERSION;
    }

    get buildHash() {
        return DEFINE_GLOBAL_HASH;
    }

    async preventConcurrentSessionAccess(sessionId) {
        return this._sendAndWaitForReply("closeSession", {sessionId});
    }

    async getRegistration() {
        if (this._registrationPromise) {
            await this._registrationPromise;
        }
        return this._registration;
    }
}
