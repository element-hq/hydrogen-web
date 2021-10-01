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

import {createEnum} from "../../utils/enum.js";
import {ObservableValue} from "../../observable/ObservableValue";

export const ConnectionStatus = createEnum(
    "Waiting",
    "Reconnecting",
    "Online"
);

export class Reconnector {
    constructor({retryDelay, createMeasure, onlineStatus}) {
        this._onlineStatus = onlineStatus;
        this._retryDelay = retryDelay;
        this._createTimeMeasure = createMeasure;
        // assume online, and do our thing when something fails
        this._state = new ObservableValue(ConnectionStatus.Online);
        this._isReconnecting = false;
        this._versionsResponse = null;
    }

    get lastVersionsResponse() {
        return this._versionsResponse;
    }

    get connectionStatus() {
        return this._state;
    }

    get retryIn() {
        if (this._state.get() === ConnectionStatus.Waiting) {
            return this._retryDelay.nextValue - this._stateSince.measure();
        }
        return 0;
    }

    async onRequestFailed(hsApi) {
        if (!this._isReconnecting) {  
            this._isReconnecting = true;
 
            const onlineStatusSubscription = this._onlineStatus && this._onlineStatus.subscribe(online => {
                if (online) {
                    this.tryNow();
                }
            });

            try {
                await this._reconnectLoop(hsApi);
            } catch (err) {
                // nothing is catching the error above us,
                // so just log here
                console.error(err);
            } finally {
                if (onlineStatusSubscription) {
                    // unsubscribe from this._onlineStatus
                    onlineStatusSubscription();
                }
                this._isReconnecting = false;
            }
        }
    }

    tryNow() {
        if (this._retryDelay) {
            // this will interrupt this._retryDelay.waitForRetry() in _reconnectLoop
            this._retryDelay.abort();
        }
    }

    _setState(state) {
        if (state !== this._state.get()) {
            if (state === ConnectionStatus.Waiting) {
                this._stateSince = this._createTimeMeasure();
            } else {
                this._stateSince = null;
            }
            this._state.set(state);
        }
    }
    
    async _reconnectLoop(hsApi) {
        this._versionsResponse = null;
        this._retryDelay.reset();

        while (!this._versionsResponse) {
            try {
                this._setState(ConnectionStatus.Reconnecting);
                // use 30s timeout, as a tradeoff between not giving up
                // too quickly on a slow server, and not waiting for
                // a stale connection when we just came online again
                const versionsRequest = hsApi.versions({timeout: 30000});
                this._versionsResponse = await versionsRequest.response();
                this._setState(ConnectionStatus.Online);
            } catch (err) {
                if (err.name === "ConnectionError") {
                    this._setState(ConnectionStatus.Waiting);
                    await this._retryDelay.waitForRetry();
                } else {
                    throw err;
                }
            }
        }
    }
}


import {Clock as MockClock} from "../../mocks/Clock.js";
import {ExponentialRetryDelay} from "./ExponentialRetryDelay.js";
import {ConnectionError} from "../error.js"

export function tests() {
    function createHsApiMock(remainingFailures) {
        return {
            versions() {
                return {
                    response() {
                        if (remainingFailures) {
                            remainingFailures -= 1;
                            return Promise.reject(new ConnectionError());
                        } else {
                            return Promise.resolve(42);
                        }
                    }
                };
            }
        }
    }

    return {
        "test reconnecting with 1 failure": async assert => {
            const clock = new MockClock();
            const {createMeasure} = clock;
            const onlineStatus = new ObservableValue(false);
            const retryDelay = new ExponentialRetryDelay(clock.createTimeout);
            const reconnector = new Reconnector({retryDelay, onlineStatus, createMeasure});
            const {connectionStatus} = reconnector;
            const statuses = [];
            const subscription = reconnector.connectionStatus.subscribe(s => {
                statuses.push(s);
            });
            reconnector.onRequestFailed(createHsApiMock(1));
            await connectionStatus.waitFor(s => s === ConnectionStatus.Waiting).promise;
            clock.elapse(2000);
            await connectionStatus.waitFor(s => s === ConnectionStatus.Online).promise;
            assert.deepEqual(statuses, [
                ConnectionStatus.Reconnecting,
                ConnectionStatus.Waiting,
                ConnectionStatus.Reconnecting,
                ConnectionStatus.Online
            ]);
            assert.strictEqual(reconnector.lastVersionsResponse, 42);
            subscription();
        },
        "test reconnecting with onlineStatus": async assert => {
            const clock = new MockClock();
            const {createMeasure} = clock;
            const onlineStatus = new ObservableValue(false);
            const retryDelay = new ExponentialRetryDelay(clock.createTimeout);
            const reconnector = new Reconnector({retryDelay, onlineStatus, createMeasure});
            const {connectionStatus} = reconnector;
            reconnector.onRequestFailed(createHsApiMock(1));
            await connectionStatus.waitFor(s => s === ConnectionStatus.Waiting).promise;
            onlineStatus.set(true); //skip waiting
            await connectionStatus.waitFor(s => s === ConnectionStatus.Online).promise;
            assert.equal(connectionStatus.get(), ConnectionStatus.Online);
            assert.strictEqual(reconnector.lastVersionsResponse, 42);
        },
    }
}
