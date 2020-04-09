const factory = {
    Clock: () => new DOMClock(),
    Request: () => fetchRequest,
    Online: () => new DOMOnline(),
    HomeServerApi: ()
}

export const LoadState = createEnum(
    "Loading",
    "InitialSync",
    "Migrating",    //not used atm, but would fit here
    "Error",
    "Ready",
);

class SessionContainer extends ObservableValue {
    constructor({clock, random, isOnline, request, storageFactory, factory}) {
        this.disposables = new Disposables();
    }

    dispose() {
        this.disposables.dispose();
    }

    get state() {
        return this._state;
    }

    _setState(state) {
        if (state !== this._state) {
            const previousState = this._state;
            this._state = state;
            this.emit(previousState);
        }
    }

    get sync() {
        return this._sync;
    }

    get session() {
        return this._session;
    }

    _createReconnector() {
        const reconnector = new Reconnector(
            new ExponentialRetryDelay(2000, this._clock.createTimeout),
            this._clock.createMeasure
        );
        // retry connection immediatly when online is detected
        this.disposables.track(isOnline.subscribe(online => {
            if(online) {
                reconnector.tryNow();
            }
        }));
        return reconnector;
    }

    async start(sessionInfo) {
        try {
            this._setState(LoadState.Loading);
            this._reconnector = this._createReconnector();
            const hsApi = this._createHsApi(sessionInfo.homeServer, sessionInfo.accessToken, this._reconnector);
            const storage = await this._storageFactory.create(sessionInfo.id);
            // no need to pass access token to session
            const filteredSessionInfo = {
                deviceId: sessionInfo.deviceId,
                userId: sessionInfo.userId,
                homeServer: sessionInfo.homeServer,
            };
            this._session = new Session({storage, sessionInfo: filteredSessionInfo, hsApi});
            await this._session.load();
            this._sync = new Sync({hsApi, storage, this._session});

            // notify sync and session when back online
            this.disposables.track(reconnector.subscribe(state => {
                this._sync.start();
                session.notifyNetworkAvailable(reconnector.lastVersionsResponse);
            }));
            
            const needsInitialSync = !this._session.syncToken;
            if (!needsInitialSync) {
                this._setState(LoadState.Ready);
            } else {
                this._setState(LoadState.InitialSync);
            }
            await this._sync.start();
            this._setState(LoadState.Ready);
            this._session.notifyNetworkAvailable();
        } catch (err) {
            this._error = err;
            this._setState(LoadState.Error);
        }
    }
}
