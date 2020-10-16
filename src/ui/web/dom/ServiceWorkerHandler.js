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
    constructor({navigation}) {
        this._waitingForReply = new Map();
        this._messageIdCounter = 0;
        this._registration = null;
        this._navigation = navigation;
        this._registrationPromise = null;
    }

    registerAndStart(path) {
        this._registrationPromise = (async () => {
            navigator.serviceWorker.addEventListener("message", this);
            navigator.serviceWorker.addEventListener("controllerchange", this);
            this._registration = await navigator.serviceWorker.register(path);
            this._registrationPromise = null;
            console.log("Service Worker registered");
            this._registration.addEventListener("updatefound", this);
            this._tryActivateUpdate();
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
        if (data.type === "closeSession") {
            const {sessionId} = data.payload;
            this._closeSessionIfNeeded(sessionId).finally(() => {
                event.source.postMessage({replyTo: data.id});
            });
        }
    }

    _closeSessionIfNeeded(sessionId) {
        const currentSession = this._navigation.path.get("session");
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

    async _tryActivateUpdate() {
        if (this._registration.waiting && this._registration.active) {
            this._registration.waiting.removeEventListener("statechange", this);
            const version = await this._sendAndWaitForReply("version", null, this._registration.waiting);
            if (confirm(`Version ${version.version} (${version.buildHash}) is ready to install. Apply now?`)) {
                this._registration.waiting.postMessage({type: "skipWaiting"}); // will trigger controllerchange event
            }
        }
    }

    handleEvent(event) {
        switch (event.type) {
            case "message":
                this._onMessage(event);
                break;
            case "updatefound":
                this._registration.installing.addEventListener("statechange", this);
                this._tryActivateUpdate();
                break;
            case "statechange":
                this._tryActivateUpdate();
                break;
            case "controllerchange":
                // active service worker changed,
                // refresh, so we can get all assets 
                // (and not some if we would not refresh)
                // up to date from it
                document.location.reload();
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

    async preventConcurrentSessionAccess(sessionId) {
        return this._sendAndWaitForReply("closeSession", {sessionId});
    }
}
