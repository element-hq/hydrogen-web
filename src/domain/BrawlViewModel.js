import Session from "../matrix/session.js";
import Sync from "../matrix/sync.js";
import SessionViewModel from "./session/SessionViewModel.js";
import LoginViewModel from "./LoginViewModel.js";
import SessionPickerViewModel from "./SessionPickerViewModel.js";
import EventEmitter from "../EventEmitter.js";

export function createNewSessionId() {
    return (Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)).toString();
}

export default class BrawlViewModel extends EventEmitter {
    constructor({storageFactory, sessionStore, createHsApi, clock}) {
        super();
        this._storageFactory = storageFactory;
        this._sessionStore = sessionStore;
        this._createHsApi = createHsApi;
        this._clock = clock;

        this._loading = false;
        this._error = null;
        this._sessionViewModel = null;
        this._loginViewModel = null;
        this._sessionPickerViewModel = null;
    }

    async load() {
        if (await this._sessionStore.hasAnySession()) {
            this._showPicker();
        } else {
            this._showLogin();
        }
    }

    async _showPicker() {
        this._clearSections();
        this._sessionPickerViewModel = new SessionPickerViewModel({
            sessionStore: this._sessionStore,
            storageFactory: this._storageFactory,
            sessionCallback: sessionInfo => this._onSessionPicked(sessionInfo)
        });
        this.emit("change", "activeSection");
        try {
            await this._sessionPickerViewModel.load();
        } catch (err) {
            this._clearSections();
            this._error = err;
            this.emit("change", "activeSection");
        }
    }

    _showLogin() {
        this._clearSections();
        this._loginViewModel = new LoginViewModel({
            createHsApi: this._createHsApi,
            defaultHomeServer: "https://matrix.org",
            loginCallback: loginData => this._onLoginFinished(loginData)
        });
        this.emit("change", "activeSection");

    }

    _showSession(session, sync) {
        this._clearSections();
        this._sessionViewModel = new SessionViewModel({session, sync});
        this.emit("change", "activeSection");
    }

    _clearSections() {
        this._error = null;
        this._loading = false;
        this._sessionViewModel = null;
        this._loginViewModel = null;
        this._sessionPickerViewModel = null;
    }

    get activeSection() {
        if (this._error) {
            return "error";
        } else if(this._loading) {
            return "loading";
        } else if (this._sessionViewModel) {
            return "session";
        } else if (this._loginViewModel) {
            return "login";
        } else {
            return "picker";
        }
    }

    get loadingText() { return this._loadingText; }
    get sessionViewModel() { return this._sessionViewModel; }
    get loginViewModel() { return this._loginViewModel; }
    get sessionPickerViewModel() { return this._sessionPickerViewModel; }
    get errorText() { return this._error && this._error.message; }

    async _onLoginFinished(loginData) {
        if (loginData) {
            // TODO: extract random() as it is a source of non-determinism
            const sessionId = createNewSessionId();
            const sessionInfo = {
                id: sessionId,
                deviceId: loginData.device_id,
                userId: loginData.user_id,
                homeServer: loginData.homeServerUrl,
                accessToken: loginData.access_token,
                lastUsed: this._clock.now()
            };
            await this._sessionStore.add(sessionInfo);
            this._loadSession(sessionInfo);
        } else {
            this._showPicker();
        }
    }

    _onSessionPicked(sessionInfo) {
        if (sessionInfo) {
            this._loadSession(sessionInfo);
            this._sessionStore.updateLastUsed(sessionInfo.id, this._clock.now());
        } else {
            this._showLogin();
        }
    }

    async _loadSession(sessionInfo) {
        try {
            this._loading = true;
            this._loadingText = "Loading your conversations…";
            const reconnector = new Reconnector(
                new ExponentialRetryDelay(2000, this._clock.createTimeout),
                this._clock.createMeasure
            );
            const hsApi = this._createHsApi(sessionInfo.homeServer, sessionInfo.accessToken, reconnector);
            const storage = await this._storageFactory.create(sessionInfo.id);
            // no need to pass access token to session
            const filteredSessionInfo = {
                deviceId: sessionInfo.deviceId,
                userId: sessionInfo.userId,
                homeServer: sessionInfo.homeServer,
            };
            const session = new Session({storage, sessionInfo: filteredSessionInfo, hsApi});
            // show spinner now, with title loading stored data?
            this.emit("change", "activeSection");
            await session.load();
            const sync = new Sync({hsApi, storage, session});

            reconnector.on("state", state => {
                if (state === ConnectionState.Online) {
                    sync.start();
                    session.notifyNetworkAvailable(reconnector.lastVersionsResponse);
                }
            });
            
            const needsInitialSync = !session.syncToken;
            if (!needsInitialSync) {
                this._showSession(session, sync);
            }
            this._loadingText = "Getting your conversations from the server…";
            this.emit("change", "loadingText");
            // update spinner title to initial sync
            await sync.start();
            if (needsInitialSync) {
                this._showSession(session, sync);
            }
            // start sending pending messages
            session.notifyNetworkAvailable();
        } catch (err) {
            console.error(err);
            this._error = err;
        }
        this.emit("change", "activeSection");
    }
}
