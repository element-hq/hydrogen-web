import {EventEmitter} from "../utils/EventEmitter.js";
import {LoadStatus} from "../matrix/SessionContainer.js";
import {AbortError} from "../utils/error.js";

export class LoginViewModel extends EventEmitter {
    constructor({sessionCallback, defaultHomeServer, createSessionContainer}) {
        super();
        this._createSessionContainer = createSessionContainer;
        this._sessionCallback = sessionCallback;
        this._defaultHomeServer = defaultHomeServer;
        this._sessionContainer = null;
        this._loadWaitHandle = null;
        this._loading = false;
        this._error = null;
    }

    get usernamePlaceholder() { return "Username"; }
    get passwordPlaceholder() { return "Password"; }
    get hsPlaceholder() { return "Your matrix homeserver"; }
    get defaultHomeServer() { return this._defaultHomeServer; }
    get error() { return this._error; }
    get loading() { return this._loading; }

    async login(username, password, homeserver) {
        try {
            this._loading = true;
            this.emit("change", "loading");
            this._sessionContainer = this._createSessionContainer();
            this._sessionContainer.startWithLogin(homeserver, username, password);
            this._loadWaitHandle = this._sessionContainer.loadStatus.waitFor(s => {
                this.emit("change", "loadStatus");
                return s === LoadStatus.Ready;
            });
            try {
                await this._loadWaitHandle.promise;
            } catch (err) {
                if (err instanceof AbortError) {
                    // login was cancelled
                    return;
                }
            }
            this._loadWaitHandle = null;
            this._sessionCallback(this._sessionContainer);
            // wait for parent view model to switch away here
        } catch (err) {
            this._error = err;
            this._loading = false;
            this.emit("change", "loading");
        }
    }

    get loadStatus() {
        return this._sessionContainer && this._sessionContainer.loadStatus;
    }

    get loadError() {
        if (this._sessionContainer) {
            const error = this._sessionContainer.loadError;
            if (error) {
                return error.message;
            }
        }
        return null;
    }

    async cancelLogin() {
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

    cancel() {
        this._sessionCallback();
    }
}
