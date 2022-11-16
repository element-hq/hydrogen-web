/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

import "@matrix-org/olm";
import {lookupHomeserver} from "./well-known";
import {AbortableOperation, IAbortable} from "../utils/AbortableOperation";
import {IWaitHandle, ObservableValue} from "../observable/ObservableValue";
import {HomeServerApi} from "./net/HomeServerApi";
import {Reconnector, ConnectionStatus} from "./net/Reconnector";
import {ExponentialRetryDelay} from "./net/ExponentialRetryDelay";
import {MediaRepository} from "./net/MediaRepository";
import {RequestScheduler} from "./net/RequestScheduler";
import {Sync, SyncStatus} from "./Sync";
import {Session} from "./Session";
import {PasswordLoginMethod} from "./login/PasswordLoginMethod";
import {TokenLoginMethod} from "./login/TokenLoginMethod";
import {SSOLoginHelper} from "./login/SSOLoginHelper";
import {getDehydratedDevice} from "./e2ee/Dehydration";
import {FlowSelector, Registration} from "./registration/Registration";
import {Platform} from "../lib";
import type {OlmWorker} from "./e2ee/OlmWorker";
import type {Storage} from "./storage/idb/Storage";
import type {ILogItem} from "../logging/types";
import type {ILoginMethod} from "./login";
import type {SubscriptionHandle} from "../observable/BaseObservable";
import type {EncryptedDehydratedDevice} from "./e2ee/Dehydration";
import type {IHomeServerRequest} from "./net/HomeServerRequest";
import type {ISessionInfo} from "./sessioninfo/localstorage/SessionInfoStorage";

export enum LoadStatus {
    NotLoading = "NotLoading",
    Login = "Login",
    LoginFailed = "LoginFailed",
    QueryAccount = "QueryAccount", // check for dehydrated device after login
    AccountSetup = "AccountSetup", // asked to restore from dehydrated device if present, call sc.accountSetup.finish() to progress to the next stage
    Loading = "Loading",
    SessionSetup = "SessionSetup", // upload e2ee keys, ...
    Migrating = "Migrating",    // not used atm, but would fit here
    FirstSync = "FirstSync",
    Error = "Error",
    Ready = "Ready",
}

export enum LoginFailure {
    Connection = "Connection",
    Credentials = "Credentials",
    Unknown = "Unknown",
}

export class Client {
    private _platform: Platform;
    private _sessionStartedByReconnector: boolean;
    private _status: ObservableValue<LoadStatus>;
    private _olmPromise: Promise<typeof window.Olm | null>
    private _workerPromise: Promise<OlmWorker | undefined>;
    private _error?: any;
    private _loginFailure?: LoginFailure;
    private _reconnector?: Reconnector;
    private _session?: Session;
    private _sync?: Sync;
    private _sessionId?: string;
    private _storage?: Storage;
    private _requestScheduler?: RequestScheduler;
    private _accountSetup?: AccountSetup;
    private _reconnectSubscription?: SubscriptionHandle;
    private _waitForFirstSyncHandle?: IWaitHandle<SyncStatus>;

    constructor(platform: Platform) {
        this._platform = platform;
        this._sessionStartedByReconnector = false;
        this._status = new ObservableValue(LoadStatus.NotLoading);
        this._olmPromise = platform.loadOlm();
        this._workerPromise = platform.loadOlmWorker();
    }

    createNewSessionId(): string {
        return (Math.floor(this._platform.random() * Number.MAX_SAFE_INTEGER)).toString();
    }

    get sessionId(): string | undefined {
        return this._sessionId;
    }

    async startWithExistingSession(sessionId: string) {
        if (this._status.get() !== LoadStatus.NotLoading) {
            return;
        }
        this._status.set(LoadStatus.Loading);
        await this._platform.logger.run("load session", async log => {
            log.set("id", sessionId);
            try {
                const sessionInfo: ISessionInfo = await this._platform.sessionInfoStorage.get(sessionId);
                if (!sessionInfo) {
                    throw new Error("Invalid session id: " + sessionId);
                }
                await this._loadSessionInfo(sessionInfo, undefined, log);
                log.set("status", this._status.get());
            } catch (err) {
                log.catch(err);
                this._error = err;
                this._status.set(LoadStatus.Error);
            }
        });
    }

    // TODO: options should become the return type of
    // hsApi.getLoginFlows().response() once that endpoint is typed.
    _parseLoginOptions(options: { flows: any; }, homeserver: string): LoginOptions {
        /*
        Take server response and return new object which has two props password and sso which
        implements LoginMethod
        */
        const flows = options.flows;
        const result: LoginOptions = {homeserver};
        for (const flow of flows) {
            if (flow.type === "m.login.password") {
                result.password = (username, password) => new PasswordLoginMethod({homeserver, username, password});
            }
            else if (flow.type === "m.login.sso" && flows.find(flow => flow.type === "m.login.token")) {
                result.sso = new SSOLoginHelper(homeserver);
            }
            else if (flow.type === "m.login.token") {
                result.token = loginToken => new TokenLoginMethod({homeserver, loginToken});
            }
        }
        return result;
    }

    queryLogin(homeserver: string): AbortableOperation<Promise<LoginOptions>, void> {
        return new AbortableOperation(async setAbortable => {
            homeserver = await lookupHomeserver(homeserver, (url, options) => {
                return setAbortable(this._platform.request(url, options));
            });
            const hsApi = new HomeServerApi({homeserver, request: this._platform.request});
            const response = await (setAbortable(await hsApi.getLoginFlows()) as IHomeServerRequest).response();
            return this._parseLoginOptions(response, homeserver);
        });
    }

    async startRegistration(
        homeserver: string,
        username: string | null,
        password: string,
        initialDeviceDisplayName: string,
        flowSelector: FlowSelector,
    ): Promise<Registration> {
        const request = this._platform.request;
        const hsApi = new HomeServerApi({homeserver, request});
        const registration = new Registration(homeserver, hsApi, {
            username,
            password,
            initialDeviceDisplayName,
            inhibitLogin: false,
        },
        flowSelector);
        return registration;
    }

    /** Method to start client after registration or with given access token.
     * To start the client after registering, use `startWithAuthData(registration.authData)`.
     * `homeserver` won't be resolved or normalized using this method,
     * use `lookupHomeserver` first if needed (not needed after registration) */
    async startWithAuthData({accessToken, deviceId, userId, homeserver}) {
        await this._platform.logger.run("startWithAuthData", async (log) => {
            await this._createSessionAfterAuth({accessToken, deviceId, userId, homeserver}, true, log);
        });
    }

    async startWithLogin(
        loginMethod: ILoginMethod,
        { inspectAccountSetup }: { inspectAccountSetup: boolean } = {
            inspectAccountSetup: false,
        }
    ) {
        const currentStatus = this._status.get();
        if (currentStatus !== LoadStatus.LoginFailed &&
            currentStatus !== LoadStatus.NotLoading &&
            currentStatus !== LoadStatus.Error) {
            return;
        }
        this._resetStatus();
        await this._platform.logger.run("login", async log => {
            this._status.set(LoadStatus.Login);
            let sessionInfo;
            try {
                const request = this._platform.request;
                const hsApi = new HomeServerApi({homeserver: loginMethod.homeserver, request});
                const loginData = await loginMethod.login(hsApi, "Hydrogen", log);
                sessionInfo = {
                    deviceId: loginData.device_id,
                    userId: loginData.user_id,
                    homeserver: loginMethod.homeserver,
                    accessToken: loginData.access_token,
                };
            } catch (err) {
                this._error = err;
                if (err.name === "HomeServerError") {
                    if (err.errcode === "M_FORBIDDEN") {
                        this._loginFailure = LoginFailure.Credentials;
                    } else {
                        this._loginFailure = LoginFailure.Unknown;
                    }
                    log.set("loginFailure", this._loginFailure);
                    this._status.set(LoadStatus.LoginFailed);
                } else if (err.name === "ConnectionError") {
                    this._loginFailure = LoginFailure.Connection;
                    this._status.set(LoadStatus.LoginFailed);
                } else {
                    this._status.set(LoadStatus.Error);
                }
                return;
            }
            await this._createSessionAfterAuth(sessionInfo, inspectAccountSetup, log);
        });
    }

    async _createSessionAfterAuth({deviceId, userId, accessToken, homeserver}: PartialISessionInfo, inspectAccountSetup: boolean, log: ILogItem) {
        const id = this.createNewSessionId();
        const lastUsed = this._platform.clock.now();
        const sessionInfo: ISessionInfo = {
            id,
            deviceId,
            userId,
            homeServer: homeserver, // deprecate this over time
            homeserver,
            accessToken,
            lastUsed,
        };
        let dehydratedDevice;
        if (inspectAccountSetup) {
            dehydratedDevice = await this._inspectAccountAfterLogin(sessionInfo, log);
            if (dehydratedDevice) {
                sessionInfo.deviceId = dehydratedDevice.deviceId;
            }
        }
        await this._platform.sessionInfoStorage.add(sessionInfo);
        // loading the session can only lead to
        // LoadStatus.Error in case of an error,
        // so separate try/catch
        try {
            await this._loadSessionInfo(sessionInfo, dehydratedDevice, log);
            log.set("status", this._status.get());
        } catch (err) {
            log.catch(err);
            // free olm Account that might be contained
            dehydratedDevice?.dispose();
            this._error = err;
            this._status.set(LoadStatus.Error);
        }
    }

    async _loadSessionInfo(sessionInfo: ISessionInfo, dehydratedDevice: any | undefined, log: ILogItem) {
        log.set("appVersion", this._platform.version);
        const clock = this._platform.clock;
        this._sessionStartedByReconnector = false;
        this._status.set(LoadStatus.Loading);
        this._reconnector = new Reconnector({
            onlineStatus: this._platform.onlineStatus,
            retryDelay: new ExponentialRetryDelay(clock.createTimeout),
            createMeasure: clock.createMeasure
        });
        const hsApi = new HomeServerApi({
            homeserver: sessionInfo.homeServer,
            accessToken: sessionInfo.accessToken,
            request: this._platform.request,
            reconnector: this._reconnector,
        });
        this._sessionId = sessionInfo.id;
        this._storage = await this._platform.storageFactory.create(sessionInfo.id, log);
        // no need to pass access token to session
        const filteredSessionInfo = {
            id: sessionInfo.id,
            deviceId: sessionInfo.deviceId,
            userId: sessionInfo.userId,
            homeserver: sessionInfo.homeServer,
        };
        const olm = await this._olmPromise;
        let olmWorker = null;
        if (this._workerPromise) {
            olmWorker = await this._workerPromise;
        }
        this._requestScheduler = new RequestScheduler({hsApi, clock});
        this._requestScheduler.start();
        const mediaRepository = new MediaRepository({
            homeserver: sessionInfo.homeServer,
            platform: this._platform,
        });
        this._session = new Session({
            storage: this._storage!,
            sessionInfo: filteredSessionInfo,
            hsApi: this._requestScheduler.hsApi,
            olm,
            olmWorker,
            mediaRepository,
            platform: this._platform,
        });
        await this._session.load(log);
        if (dehydratedDevice) {
            await log.wrap("dehydrateIdentity", log => this.session.dehydrateIdentity(dehydratedDevice, log));
            await this.session.setupDehydratedDevice(dehydratedDevice.key, log);
        } else if (!this.session.hasIdentity) {
            this._status.set(LoadStatus.SessionSetup);
            await log.wrap("createIdentity", log => this.session.createIdentity(log));
        }

        this._sync = new Sync({hsApi: this._requestScheduler.hsApi, storage: this._storage!, session: this.session, logger: this._platform.logger});
        // notify sync and session when back online
        this._reconnectSubscription = this._reconnector.connectionStatus.subscribe(state => {
            if (state === ConnectionStatus.Online) {
                this._platform.logger.runDetached("reconnect", async log => {
                    // needs to happen before sync and session or it would abort all requests
                    this._requestScheduler?.start();
                    this._sync?.start();
                    this._sessionStartedByReconnector = true;
                    const d = dehydratedDevice;
                    dehydratedDevice = undefined;
                    await log.wrap("session start", log => this.session.start(this._reconnector?.lastVersionsResponse, d, log));
                });
            }
        });
        await log.wrap("wait first sync", () => this._waitForFirstSync());
        if (this._isDisposed) {
            return;
        }
        this._status.set(LoadStatus.Ready);

        // if the sync failed, and then the reconnector
        // restored the connection, it would have already
        // started to session, so check first
        // to prevent an extra /versions request
        if (!this._sessionStartedByReconnector) {
            const lastVersionsResponse = await hsApi.versions({timeout: 10000, log}).response();
            if (this._isDisposed) {
                return;
            }
            const d = dehydratedDevice;
            dehydratedDevice = undefined;
            // log as ref as we don't want to await it
            await log.wrap("session start", log => this.session.start(lastVersionsResponse, d, log));
        }
    }

    async _waitForFirstSync() {
        this._sync?.start();
        this._status.set(LoadStatus.FirstSync);
        // only transition into Ready once the first sync has succeeded
        this._waitForFirstSyncHandle = this._sync?.status.waitFor(s => {
            if (s === SyncStatus.Stopped) {
                // keep waiting if there is a ConnectionError
                // as the reconnector above will call
                // sync.start again to retry in this case
                return this._sync?.error?.name !== "ConnectionError";
            }
            return s === SyncStatus.Syncing;
        });
        try {
            await this._waitForFirstSyncHandle?.promise;
            if (this._sync?.status.get() === SyncStatus.Stopped && this._sync.error) {
                throw this._sync.error;
            }
        } catch (err) {
            // if dispose is called from stop, bail out
            if (err.name === "AbortError") {
                return;
            }
            throw err;
        } finally {
            this._waitForFirstSyncHandle = undefined;
        }
    }

    _inspectAccountAfterLogin(sessionInfo: ISessionInfo, log: ILogItem) {
        return log.wrap("inspectAccount", async log => {
            this._status.set(LoadStatus.QueryAccount);
            const hsApi = new HomeServerApi({
                homeserver: sessionInfo.homeServer,
                accessToken: sessionInfo.accessToken,
                request: this._platform.request,
            });
            const olm = await this._olmPromise;
            let encryptedDehydratedDevice: EncryptedDehydratedDevice;
            try {
                encryptedDehydratedDevice = await getDehydratedDevice(hsApi, olm, this._platform, log);
            } catch (err) {
                if (err.name === "HomeServerError") {
                    log.set("not_supported", true);
                } else {
                    throw err;
                }
            }
            if (encryptedDehydratedDevice) {
                let resolveStageFinish;
                const promiseStageFinish = new Promise(r => resolveStageFinish = r);
                this._accountSetup = new AccountSetup(encryptedDehydratedDevice, resolveStageFinish);
                this._status.set(LoadStatus.AccountSetup);
                await promiseStageFinish;
                const dehydratedDevice = this._accountSetup?._dehydratedDevice;
                this._accountSetup = undefined;
                return dehydratedDevice;
            }
        });
    }

    get accountSetup(): AccountSetup | undefined {
        return this._accountSetup;
    }

    get loadStatus(): ObservableValue<LoadStatus> {
        return this._status;
    }

    get loadError(): any {
        return this._error;
    }

    get loginFailure(): LoginFailure | undefined {
        return this._loginFailure;
    }

    /** only set at loadStatus InitialSync, CatchupSync or Ready */
    get sync(): Sync | undefined {
        return this._sync;
    }

    /** only set at loadStatus InitialSync, CatchupSync or Ready */
    get session(): Session {
        if (!this._session) throw new Error("client is missing session")
        return this._session;
    }

    get reconnector(): Reconnector | undefined {
        return this._reconnector;
    }

    get _isDisposed(): boolean {
        return !this._reconnector;
    }

    startLogout(sessionId: string) {
        return this._platform.logger.run("logout", async log => {
            this._sessionId = sessionId;
            log.set("id", this._sessionId);
            const sessionInfo = await this._platform.sessionInfoStorage.get(this._sessionId);
            if (!sessionInfo) {
                throw new Error(`Could not find session for id ${this._sessionId}`);
            }
            try {
                const hsApi = new HomeServerApi({
                    homeserver: sessionInfo.homeServer,
                    accessToken: sessionInfo.accessToken,
                    request: this._platform.request
                });
                await hsApi.logout({log}).response();
            } catch (err) {}
            await this.deleteSession(log);
        });
    }

    startForcedLogout(sessionId: string | undefined) {
        return this._platform.logger.run("forced-logout", async log => {
            this._sessionId = sessionId;
            log.set("id", this._sessionId);
            await this.deleteSession(log);
        });
    }

    dispose() {
        if (this._reconnectSubscription) {
            this._reconnectSubscription();
            this._reconnectSubscription = undefined;
        }
        this._reconnector = undefined;
        if (this._requestScheduler) {
            this._requestScheduler.stop();
            this._requestScheduler = undefined;
        }
        if (this._sync) {
            this._sync.stop();
            this._sync = undefined;
        }
        if (this._session) {
            this._session.dispose();
            this._session = undefined;
        }
        if (this._waitForFirstSyncHandle) {
            this._waitForFirstSyncHandle.dispose();
            this._waitForFirstSyncHandle = undefined;
        }
        if (this._storage) {
            this._storage.close();
            this._storage = undefined;
        }
    }

    async deleteSession(log?: ILogItem) {
        if (this._sessionId) {
            // need to dispose first, so the storage is closed,
            // and also first sync finishing won't call Session.start anymore,
            // which assumes that the storage works.
            this.dispose();
            // if one fails, don't block the other from trying
            // also, run in parallel
            await Promise.all([
                log?.wrap("storageFactory", () => this._platform.storageFactory.delete(this._sessionId)),
                log?.wrap("sessionInfoStorage", () => this._platform.sessionInfoStorage.delete(this._sessionId)),
            ]);
            this._sessionId = undefined;
        }
    }

    _resetStatus() {
        this._status.set(LoadStatus.NotLoading);
        this._error = undefined;
        this._loginFailure = undefined;
    }
}

class AccountSetup {
    _encryptedDehydratedDevice: EncryptedDehydratedDevice;
    _dehydratedDevice?: any;
    _finishStage: any;

    constructor(encryptedDehydratedDevice: EncryptedDehydratedDevice, finishStage: any) {
        this._encryptedDehydratedDevice = encryptedDehydratedDevice;
        this._dehydratedDevice = undefined;
        this._finishStage = finishStage;
    }

    get encryptedDehydratedDevice(): any | undefined {
        return this._encryptedDehydratedDevice;
    }

    finish(dehydratedDevice: any) {
        this._dehydratedDevice = dehydratedDevice;
        this._finishStage();
    }
}

export type LoginOptions = {
    homeserver: string;
    password?: (username: string, password: string) => PasswordLoginMethod;
    sso?: SSOLoginHelper;
    token?: (loginToken: string) => TokenLoginMethod;
};

type PartialISessionInfo = {
    deviceId: string;
    userId: string;
    accessToken: string;
    homeserver: string;
}