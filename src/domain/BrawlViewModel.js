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
        this._sessionSubscription = null;
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
        this._setSection(() => {
            this._sessionPickerViewModel = new SessionPickerViewModel({
                sessionStore: this._sessionStore,
                storageFactory: this._storageFactory,
                sessionCallback: sessionInfo => this._onSessionPicked(sessionInfo)
            });
        });
        try {
            await this._sessionPickerViewModel.load();
        } catch (err) {
            this._setSection(() => this._error = err);
        }
    }

    _showLogin() {
        this._setSection(() => {
            this._loginViewModel = new LoginViewModel({
                createHsApi: this._createHsApi,
                defaultHomeServer: "https://matrix.org",
                loginCallback: loginData => this._onLoginFinished(loginData)
            });
        })

    }

    _showSession(session, sync) {
        this._setSection(() => {
            this._sessionViewModel = new SessionViewModel({session, sync});
        });
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

    _setSection(setter) {
        const oldSection = this.activeSection;
        // clear all members the activeSection depends on
        this._error = null;
        this._loading = false;
        this._sessionViewModel = null;
        this._loginViewModel = null;
        this._sessionPickerViewModel = null;
        // now set it again
        setter();
        const newSection = this.activeSection;
        // remove session subscription when navigating away
        if (oldSection === "session" && newSection !== oldSection) {
            this._sessionSubscription();
            this._sessionSubscription = null;
        }
        this.emit("change", "activeSection");
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
        this._setSection(() => {
            // TODO this is pseudo code-ish
            const container = this._createSessionContainer();
            this._sessionViewModel = new SessionViewModel({session, sync});
            this._sessionSubscription = this._activeSessionContainer.subscribe(this._updateSessionState);
            this._activeSessionContainer.start(sessionInfo);
        });
    }
}
