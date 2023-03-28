/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import {RetainedObservableValue} from "../../observable/value";

import type {HomeServerApi} from "../net/HomeServerApi";
import type {IHomeServerRequest} from "../net/HomeServerRequest";
import type {BaseObservableValue, ObservableValue} from "../../observable/value";
import type {Clock, Timeout} from "../../platform/web/dom/Clock";
import type {ILogItem} from "../../logging/types";

type TurnServerSettings = {
    uris: string[],
    username: string,
    password: string,
    ttl: number
};

const DEFAULT_TTL = 5 * 60; // 5min
const DEFAULT_SETTINGS: RTCIceServer = {
    urls: ["stun:turn.matrix.org"],
    username: "",
    credential: "",
};

export class TurnServerSource {
    private currentObservable?: ObservableValue<RTCIceServer>;
    private pollTimeout?: Timeout;
    private pollRequest?: IHomeServerRequest;
    private isPolling = false;

    constructor(
        private hsApi: HomeServerApi,
        private clock: Clock,
        private defaultSettings: RTCIceServer = DEFAULT_SETTINGS
    ) {}

    getSettings(log: ILogItem): Promise<BaseObservableValue<RTCIceServer>> {
        return log.wrap("get turn server", async log => {
            if (!this.isPolling) {
                const settings = await this.doRequest(log);
                const iceServer = settings ? toIceServer(settings) : this.defaultSettings;
                log.set("iceServer", iceServer);
                if (this.currentObservable) {
                    this.currentObservable.set(iceServer);
                } else {
                    this.currentObservable = new RetainedObservableValue(iceServer, 
                        () => {
                            this.stopPollLoop();
                        },
                        () => {
                            // start loop on first subscribe
                            this.runLoop(settings?.ttl ?? DEFAULT_TTL);
                        });
                }
            }
            return this.currentObservable!;
        });
    }

    private async runLoop(initialTtl: number): Promise<void> {
        let ttl = initialTtl;
        this.isPolling = true;
        while(this.isPolling) {
            try {
                this.pollTimeout = this.clock.createTimeout(ttl * 1000);
                await this.pollTimeout.elapsed();
                this.pollTimeout = undefined;
                const settings = await this.doRequest(undefined);
                if (settings) {
                    const iceServer = toIceServer(settings);
                    if (shouldUpdate(this.currentObservable!, iceServer)) {
                        this.currentObservable!.set(iceServer);
                    }
                    if (settings.ttl > 0) {
                        ttl = settings.ttl;
                    } else {
                        // stop polling is settings are good indefinitely
                        this.stopPollLoop();
                    }
                } else {
                    ttl = DEFAULT_TTL;
                }
            } catch (err) {
                if (err.name === "AbortError") {
                    /* ignore, the loop will exit because isPolling is false */
                } else {
                    // TODO: log error
                }
            }
        }
    }

    private async doRequest(log: ILogItem | undefined): Promise<TurnServerSettings | undefined> {
        try {
            this.pollRequest = this.hsApi.getTurnServer({log});
            const settings = await this.pollRequest.response();
            return settings;
        } catch (err) {
            if (err.name === "HomeServerError") {
                return undefined;
            }
            throw err;
        } finally {
            this.pollRequest = undefined;
        }
    }

    private stopPollLoop() {
        this.isPolling = false;
        this.currentObservable = undefined;
        this.pollTimeout?.dispose();
        this.pollTimeout = undefined;
        this.pollRequest?.abort();
        this.pollRequest = undefined;
    }

    dispose() {
        this.stopPollLoop();
    }
}

function shouldUpdate(observable: BaseObservableValue<RTCIceServer | undefined>, settings: RTCIceServer): boolean {
    const currentSettings = observable.get();
    if (!currentSettings) {
        return true;
    }
    // same length and new settings doesn't contain any uri the old settings don't contain
    const currentUrls = Array.isArray(currentSettings.urls) ? currentSettings.urls : [currentSettings.urls];
    const newUrls = Array.isArray(settings.urls) ? settings.urls : [settings.urls];
    const arraysEqual = currentUrls.length === newUrls.length &&
        !newUrls.some(uri => !currentUrls.includes(uri));
    return !arraysEqual || settings.username !== currentSettings.username ||
        settings.credential !== currentSettings.credential;
}

function toIceServer(settings: TurnServerSettings): RTCIceServer {
    return {
        urls: settings.uris,
        username: settings.username,
        credential: settings.password,
        // @ts-ignore
        // this field is deprecated but providing it nonetheless
        credentialType: "password"
    }
}

export function tests() {
    return {
        "shouldUpdate returns false for same object": assert => {
            const observable = {get() {
                return {
                    urls: ["a", "b"],
                    username: "alice",
                    credential: "f00",
                };
            }};
            const same = {
                urls: ["a", "b"],
                username: "alice",
                credential: "f00",
            };
            assert.equal(false, shouldUpdate(observable as any as BaseObservableValue<RTCIceServer>, same));
        },
        "shouldUpdate returns true for 1 different uri": assert => {
            const observable = {get() {
                return {
                    urls: ["a", "c"],
                    username: "alice",
                    credential: "f00",
                };
            }};
            const same = {
                urls: ["a", "b"],
                username: "alice",
                credential: "f00",
            };
            assert.equal(true, shouldUpdate(observable as any as BaseObservableValue<RTCIceServer>, same));
        },
        "shouldUpdate returns true for different user": assert => {
            const observable = {get() {
                return {
                    urls: ["a", "b"],
                    username: "alice",
                    credential: "f00",
                };
            }};
            const same = {
                urls: ["a", "b"],
                username: "bob",
                credential: "f00",
            };
            assert.equal(true, shouldUpdate(observable as any as BaseObservableValue<RTCIceServer>, same));
        },
        "shouldUpdate returns true for different password": assert => {
            const observable = {get() {
                return {
                    urls: ["a", "b"],
                    username: "alice",
                    credential: "f00",
                };
            }};
            const same = {
                urls: ["a", "b"],
                username: "alice",
                credential: "b4r",
            };
            assert.equal(true, shouldUpdate(observable as any as BaseObservableValue<RTCIceServer>, same));
        }
    }
}
