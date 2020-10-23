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

import {createEnum} from "../utils/enum.js";
import {ObservableValue} from "../observable/ObservableValue.js";
import {HomeServerApi} from "./net/HomeServerApi.js";
import {Reconnector, ConnectionStatus} from "./net/Reconnector.js";
import {ExponentialRetryDelay} from "./net/ExponentialRetryDelay.js";
import {MediaRepository} from "./net/MediaRepository.js";
import {RequestScheduler} from "./net/RequestScheduler.js";
import {HomeServerError, ConnectionError, AbortError} from "./error.js";
import {Sync, SyncStatus} from "./Sync.js";
import {Session} from "./Session.js";

export const LoadStatus = createEnum(
    "NotLoading",
    "Login",
    "LoginFailed",
    "Loading",
    "SessionSetup", // upload e2ee keys, ...
    "Migrating",    //not used atm, but would fit here
    "FirstSync",
    "Error",
    "Ready",
);

export const LoginFailure = createEnum(
    "Connection",
    "Credentials",
    "Unknown",
);

export class SessionContainer {
    constructor({clock, random, onlineStatus, request, storageFactory, sessionInfoStorage, olmPromise, workerPromise, cryptoDriver}) {
        this._random = random;
        this._clock = clock;
        this._onlineStatus = onlineStatus;
        this._request = request;
        this._storageFactory = storageFactory;
        this._sessionInfoStorage = sessionInfoStorage;
        this._sessionStartedByReconnector = false;
        this._status = new ObservableValue(LoadStatus.NotLoading);
        this._error = null;
        this._loginFailure = null;
        this._reconnector = null;
        this._session = null;
        this._sync = null;
        this._sessionId = null;
        this._storage = null;
        this._requestScheduler = null;
        this._olmPromise = olmPromise;
        this._workerPromise = workerPromise;
        this._cryptoDriver = cryptoDriver;
    }

    createNewSessionId() {
        return (Math.floor(this._random() * Number.MAX_SAFE_INTEGER)).toString();
    }

    get sessionId() {
        return this._sessionId;
    }

    async startWithExistingSession(sessionId) {
        if (this._status.get() !== LoadStatus.NotLoading) {
            return;
        }
        this._status.set(LoadStatus.Loading);
        try {
            const sessionInfo = await this._sessionInfoStorage.get(sessionId);
            if (!sessionInfo) {
                throw new Error("Invalid session id: " + sessionId);
            }
            await this._loadSessionInfo(sessionInfo, false);
        } catch (err) {
            this._error = err;
            this._status.set(LoadStatus.Error);
        }
    }

    async startWithLogin(homeServer, username, password) {
        if (this._status.get() !== LoadStatus.NotLoading) {
            return;
        }
        this._status.set(LoadStatus.Login);
        let sessionInfo;
        try {
            const hsApi = new HomeServerApi({homeServer, request: this._request, createTimeout: this._clock.createTimeout});
            const loginData = await hsApi.passwordLogin(username, password, "Hydrogen").response();
            const sessionId = this.createNewSessionId();
            sessionInfo = {
                id: sessionId,
                deviceId: loginData.device_id,
                userId: loginData.user_id,
                homeServer: homeServer,
                accessToken: loginData.access_token,
                lastUsed: this._clock.now()
            };
            await this._sessionInfoStorage.add(sessionInfo);            
        } catch (err) {
            this._error = err;
            if (err instanceof HomeServerError) {
                if (err.errcode === "M_FORBIDDEN") {
                    this._loginFailure = LoginFailure.Credentials;
                } else {
                    this._loginFailure = LoginFailure.Unknown;
                }
                this._status.set(LoadStatus.LoginFailed);
            } else if (err instanceof ConnectionError) {
                this._loginFailure = LoginFailure.Connection;
                this._status.set(LoadStatus.LoginFailed);
            } else {
                this._status.set(LoadStatus.Error);
            }
            return;
        }
        // loading the session can only lead to
        // LoadStatus.Error in case of an error,
        // so separate try/catch
        try {
            await this._loadSessionInfo(sessionInfo, true);
        } catch (err) {
            this._error = err;
            this._status.set(LoadStatus.Error);
        }
    }

    async _loadSessionInfo(sessionInfo, isNewLogin) {
        this._sessionStartedByReconnector = false;
        this._status.set(LoadStatus.Loading);
        this._reconnector = new Reconnector({
            onlineStatus: this._onlineStatus,
            retryDelay: new ExponentialRetryDelay(this._clock.createTimeout),
            createMeasure: this._clock.createMeasure
        });
        const hsApi = new HomeServerApi({
            homeServer: sessionInfo.homeServer,
            accessToken: sessionInfo.accessToken,
            request: this._request,
            reconnector: this._reconnector,
            createTimeout: this._clock.createTimeout
        });
        this._sessionId = sessionInfo.id;
        this._storage = await this._storageFactory.create(sessionInfo.id);
        // no need to pass access token to session
        const filteredSessionInfo = {
            deviceId: sessionInfo.deviceId,
            userId: sessionInfo.userId,
            homeServer: sessionInfo.homeServer,
        };
        const olm = await this._olmPromise;
        let olmWorker = null;
        if (this._workerPromise) {
            olmWorker = await this._workerPromise;
        }
        this._requestScheduler = new RequestScheduler({hsApi, clock: this._clock});
        this._requestScheduler.start();
        this._session = new Session({
            storage: this._storage,
            sessionInfo: filteredSessionInfo,
            hsApi: this._requestScheduler.hsApi,
            olm,
            clock: this._clock,
            olmWorker,
            cryptoDriver: this._cryptoDriver,
            mediaRepository: new MediaRepository(sessionInfo.homeServer)
        });
        await this._session.load();
        if (isNewLogin) {
            this._status.set(LoadStatus.SessionSetup);
            await this._session.createIdentity();
        }
        
        this._sync = new Sync({hsApi: this._requestScheduler.hsApi, storage: this._storage, session: this._session});
        // notify sync and session when back online
        this._reconnectSubscription = this._reconnector.connectionStatus.subscribe(state => {
            if (state === ConnectionStatus.Online) {
                // needs to happen before sync and session or it would abort all requests
                this._requestScheduler.start();
                this._sync.start();
                this._sessionStartedByReconnector = true;
                this._session.start(this._reconnector.lastVersionsResponse);
            }
        });
        await this._waitForFirstSync();

        this._status.set(LoadStatus.Ready);

        // if the sync failed, and then the reconnector
        // restored the connection, it would have already
        // started to session, so check first
        // to prevent an extra /versions request
        if (!this._sessionStartedByReconnector) {
            const lastVersionsResponse = await hsApi.versions({timeout: 10000}).response();
            this._session.start(lastVersionsResponse);
        }
    }

    async _waitForFirstSync() {
        try {
            this._sync.start();
            this._status.set(LoadStatus.FirstSync);
        } catch (err) {
            // swallow ConnectionError here and continue,
            // as the reconnector above will call 
            // sync.start again to retry in this case
            if (!(err instanceof ConnectionError)) {
                throw err;
            }
        }
        // only transition into Ready once the first sync has succeeded
        this._waitForFirstSyncHandle = this._sync.status.waitFor(s => s === SyncStatus.Syncing || s === SyncStatus.Stopped);
        try {
            await this._waitForFirstSyncHandle.promise;
            if (this._sync.status.get() === SyncStatus.Stopped) {
                if (this._sync.error) {
                    throw this._sync.error;
                }
            }
        } catch (err) {
            // if dispose is called from stop, bail out
            if (err instanceof AbortError) {
                return;
            }
            throw err;
        } finally {
            this._waitForFirstSyncHandle = null;
        }
    }


    get loadStatus() {
        return this._status;
    }

    get loadError() {
        return this._error;
    }

    /** only set at loadStatus InitialSync, CatchupSync or Ready */
    get sync() {
        return this._sync;
    }

    /** only set at loadStatus InitialSync, CatchupSync or Ready */
    get session() {
        return this._session;
    }

    get reconnector() {
        return this._reconnector;
    }

    dispose() {
        if (this._reconnectSubscription) {
            this._reconnectSubscription();
            this._reconnectSubscription = null;
        }
        if (this._requestScheduler) {
            this._requestScheduler.stop();
        }
        if (this._sync) {
            this._sync.stop();
        }
        if (this._session) {
            this._session.dispose();
        }
        if (this._waitForFirstSyncHandle) {
            this._waitForFirstSyncHandle.dispose();
            this._waitForFirstSyncHandle = null;
        }
        if (this._storage) {
            this._storage.close();
            this._storage = null;
        }
    }

    async deleteSession() {
        if (this._sessionId) {
            // if one fails, don't block the other from trying
            // also, run in parallel
            await Promise.all([
                this._storageFactory.delete(this._sessionId),
                this._sessionInfoStorage.delete(this._sessionId),
            ]);
            this._sessionId = null;
        }
    }
}
