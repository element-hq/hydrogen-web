import HomeServerApi from "./net/HomeServerApi.js";

export const LoadStatus = createEnum(
    "NotLoading",
    "Login",
    "LoginFailed",
    "Loading",
    "Migrating",    //not used atm, but would fit here
    "InitialSync",
    "CatchupSync",
    "Error",
    "Ready",
);

export const LoginFailure = createEnum(
    "Network",
    "Credentials",
    "Unknown",
);

export class SessionContainer {
    constructor({clock, random, onlineStatus, request, storageFactory, sessionsStore}) {
        this._random = random;
        this._clock = clock;
        this._onlineStatus = onlineStatus;
        this._request = request;
        this._storageFactory = storageFactory;
        this._sessionsStore = sessionsStore;

        this._status = new ObservableValue(LoadStatus.NotLoading);
        this._error = null;
        this._loginFailure = null;
        this._reconnector = null;
        this._session = null;
        this._sync = null;
    }

    _createNewSessionId() {
        return (Math.floor(this._random() * Number.MAX_SAFE_INTEGER)).toString();
    }

    async startWithExistingSession(sessionId) {
        if (this._status.get() !== LoadStatus.NotLoading) {
            return;
        }
        this._status.set(LoadStatus.Loading);
        try {
            const sessionInfo = await this._sessionsStore.get(sessionId);
            await this._loadSessionInfo(sessionInfo);
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
            const hsApi = new HomeServerApi({homeServer, request: this._request});
            const loginData = await hsApi.passwordLogin(username, password).response();
            const sessionId = this._createNewSessionId();
            sessionInfo = {
                id: sessionId,
                deviceId: loginData.device_id,
                userId: loginData.user_id,
                homeServer: homeServer,
                accessToken: loginData.access_token,
                lastUsed: this._clock.now()
            };
            await this._sessionsStore.add(sessionInfo);            
        } catch (err) {
            this._error = err;
            if (err instanceof HomeServerError) {
                if (err.statusCode === 403) {
                    this._loginFailure = LoginFailure.Credentials;
                } else {
                    this._loginFailure = LoginFailure.Unknown;
                }
                this._status.set(LoadStatus.LoginFailure);
            } else if (err instanceof ConnectionError) {
                this._loginFailure = LoginFailure.Network;
                this._status.set(LoadStatus.LoginFailure);
            } else {
                this._status.set(LoadStatus.Error);
            }
            return;
        }
        // loading the session can only lead to
        // LoadStatus.Error in case of an error,
        // so separate try/catch
        try {
            await this._loadSessionInfo(sessionInfo);
        } catch (err) {
            this._error = err;
            this._status.set(LoadStatus.Error);
        }
    }

    async _loadSessionInfo(sessionInfo) {
        this._status.set(LoadStatus.Loading);
        this._reconnector = new Reconnector({
            onlineStatus: this._onlineStatus,
            delay: new ExponentialRetryDelay(2000, this._clock.createTimeout),
            createMeasure: this._clock.createMeasure
        });
        const hsApi = new HomeServerApi({
            homeServer: sessionInfo.homeServer,
            accessToken: sessionInfo.accessToken,
            request: this._request,
            reconnector: this._reconnector,
        });
        const storage = await this._storageFactory.create(sessionInfo.id);
        // no need to pass access token to session
        const filteredSessionInfo = {
            deviceId: sessionInfo.deviceId,
            userId: sessionInfo.userId,
            homeServer: sessionInfo.homeServer,
        };
        this._session = new Session({storage, sessionInfo: filteredSessionInfo, hsApi});
        await this._session.load();
        
        const needsInitialSync = !this._session.syncToken;
        if (!needsInitialSync) {
            this._status.set(LoadStatus.CatchupSync);
        } else {
            this._status.set(LoadStatus.InitialSync);
        }

        this._sync = new Sync({hsApi, storage, session: this._session});
        // notify sync and session when back online
        this._reconnectSubscription = this._reconnector.connectionStatus.subscribe(state => {
            if (state === ConnectionStatus.Online) {
                this._sync.start();
                this._session.start(this._reconnector.lastVersionsResponse);
            }
        });
        await this._waitForFirstSync();
        this._status.set(LoadStatus.Ready);

        // if this fails, the reconnector will start polling versions to reconnect
        const lastVersionsResponse = await hsApi.versions({timeout: 10000}).response();
        this._session.start(lastVersionsResponse);
    }

    async _waitForFirstSync() {
        try {
            await this._sync.start();
        } catch (err) {
            // swallow ConnectionError here and continue,
            // as the reconnector above will call 
            // sync.start again to retry in this case
            if (!(err instanceof ConnectionError)) {
                throw err;
            }
        }
        // only transition into Ready once the first sync has succeeded
        this._waitForFirstSyncHandle = this._sync.status.waitFor(s => s === SyncStatus.Syncing);
        try {
            await this._waitForFirstSyncHandle.promise;
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

    stop() {
        this._reconnectSubscription();
        this._reconnectSubscription = null;
        this._sync.stop();
        this._session.stop();
        if (this._waitForFirstSyncHandle) {
            this._waitForFirstSyncHandle.dispose();
            this._waitForFirstSyncHandle = null;
        }
    }
}

/*
function main() {
    // these are only required for external classes,
    // SessionFactory has it's defaults for internal classes
    const sessionFactory = new SessionFactory({
        Clock: DOMClock,
        OnlineState: DOMOnlineState,
        SessionsStore: LocalStorageSessionStore,    // should be called SessionInfoStore?
        StorageFactory: window.indexedDB ? IDBStorageFactory : MemoryStorageFactory,  // should be called StorageManager?
        // should be moved to StorageFactory as `KeyBounds`?: minStorageKey, middleStorageKey, maxStorageKey
        // would need to pass it into EventKey though
        request,
    });

    // lets not do this in a first cut
    // internally in the matrix lib
    const room = new creator.ctor("Room", Room)({});

    // or short
    const sessionFactory = new SessionFactory(WebFactory);
    // sessionFactory.sessionInfoStore
    
    // registration
    // const registration = sessionFactory.registerUser();
    // registration.stage
    

    const container = sessionFactory.startWithRegistration(registration);
    const container = sessionFactory.startWithLogin(server, username, password);
    const container = sessionFactory.startWithExistingSession(sessionId);
    // container.loadStatus is an ObservableValue<LoadStatus>
    await container.loadStatus.waitFor(s => s === LoadStatus.Loaded || s === LoadStatus.CatchupSync);

    // loader isn't needed anymore from now on
    const {session, sync, reconnector} = container;
    container.stop();
}
*/
