import {EventEmitter} from "../utils/EventEmitter.js";
import {LoadStatus, LoginFailure} from "../matrix/SessionContainer.js";
import {AbortError} from "../utils/error.js";
import {loadLabel} from "./common.js";

function loadLoginLabel(loadStatus, loadError, loginFailure, homeserver) {
    if (!loadError && loadStatus && loadStatus.get() === LoadStatus.LoginFailed) {
        switch (loginFailure) {
            case LoginFailure.LoginFailure:
                return `Your username and/or password don't seem to be correct.`;
            case LoginFailure.Connection:
                return `Can't connect to ${homeserver}.`;
            case LoginFailure.Unknown:
                return `Something went wrong while checking your login and password.`;
        }
    }
    return loadLabel(loadStatus, loadError);
}

export class LoginViewModel extends EventEmitter {
    constructor({sessionCallback, defaultHomeServer, createSessionContainer}) {
        super();
        this._createSessionContainer = createSessionContainer;
        this._sessionCallback = sessionCallback;
        this._defaultHomeServer = defaultHomeServer;
        this._homeserver = null;
        this._sessionContainer = null;
        this._loadWaitHandle = null;
        this._loading = false;
        this._error = null;
    }

    get usernamePlaceholder() { return "Username"; }
    get passwordPlaceholder() { return "Password"; }
    get hsPlaceholder() { return "Your matrix homeserver"; }
    get defaultHomeServer() { return this._defaultHomeServer; }
    get loading() {return this._loading}

    get showLoadLabel() {
        return this._loading || this._sessionContainer || this._error;
    }

    async login(username, password, homeserver) {
        try {
            this._loading = true;
            this.emit("change", "loading");
            this._homeserver = homeserver;
            this._sessionContainer = this._createSessionContainer();
            this._sessionContainer.startWithLogin(homeserver, username, password);
            this._loadWaitHandle = this._sessionContainer.loadStatus.waitFor(s => {
                this.emit("change", "loadLabel");
                return s === LoadStatus.Ready ||
                       s === LoadStatus.LoginFailed ||
                       s === LoadStatus.Error;
            });
            try {
                await this._loadWaitHandle.promise;
            } catch (err) {
                if (err instanceof AbortError) {
                    // login was cancelled
                } else {
                    throw err;
                }
            }
            this._loadWaitHandle = null;
            if (this._sessionContainer.loadStatus.get() === LoadStatus.Ready) {
                this._sessionCallback(this._sessionContainer);
                // wait for parent view model to switch away here
            } else {
                this._loading = false;
                this.emit("change", "loading");
                if (this._sessionContainer.loadError) {
                    console.error(this._sessionContainer.loadError);
                }
            }
        } catch (err) {
            this._error = err;
            this._loading = false;
            this.emit("change", "loading");
        }
    }

    get loadLabel() {
        if (this._error) {
            return loadLabel(null, this._error);
        }
        if (this.showLoadLabel) {
            const sc = this._sessionContainer;
            return loadLoginLabel(
                sc && sc.loadStatus,
                sc && sc.loadError,
                sc && sc.loginFailure,
                this._homeserver
            );
        }
        return null;
    }

    async cancel() {
        if (!this._loading) {
            return;
        }
        this._loading = false;
        this.emit("change", "loading");
        if (this._sessionContainer) {
            this._sessionContainer.stop();
            await this._sessionContainer.deleteSession();
            this._sessionContainer = null;
        }
        if (this._loadWaitHandle) {
            // rejects with AbortError
            this._loadWaitHandle.dispose();
            this._loadWaitHandle = null;
        }
    }

    goBack() {
        if (!this._loading) {
            this._sessionCallback();
        }
    }
}
