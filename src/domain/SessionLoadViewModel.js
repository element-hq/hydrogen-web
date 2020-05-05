import {LoadStatus, LoginFailure} from "../matrix/SessionContainer.js";
import {SyncStatus} from "../matrix/Sync.js";
import {ViewModel} from "./ViewModel.js";

export class SessionLoadViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {createAndStartSessionContainer, sessionCallback, homeserver, deleteSessionOnCancel} = options;
        this._createAndStartSessionContainer = createAndStartSessionContainer;
        this._sessionCallback = sessionCallback;
        this._homeserver = homeserver;
        this._deleteSessionOnCancel = deleteSessionOnCancel;
        this._loading = false;
        this._error = null;
    }

    async start() {
        if (this._loading) {
            return;
        }
        try {
            this._loading = true;
            this.emitChange();
            this._sessionContainer = this._createAndStartSessionContainer();
            this._waitHandle = this._sessionContainer.loadStatus.waitFor(s => {
                this.emitChange();
                // wait for initial sync, but not catchup sync
                const isCatchupSync = s === LoadStatus.FirstSync &&
                    this._sessionContainer.sync.status.get() === SyncStatus.CatchupSync;
                return isCatchupSync ||
                    s === LoadStatus.LoginFailed ||
                    s === LoadStatus.Error ||
                    s === LoadStatus.Ready;
            });
            try {
                await this._waitHandle.promise;
            } catch (err) {
                return; // aborted by goBack
            }
            // TODO: should we deal with no connection during initial sync 
            // and we're retrying as well here?
            // e.g. show in the label what is going on wrt connectionstatus
            // much like we will once you are in the app. Probably a good idea

            // did it finish or get stuck at LoginFailed or Error?
            const loadStatus = this._sessionContainer.loadStatus.get();
            if (loadStatus === LoadStatus.FirstSync || loadStatus === LoadStatus.Ready) {
                this._sessionCallback(this._sessionContainer);
            }
        } catch (err) {
            this._error = err;
        } finally {
            this._loading = false;
            this.emitChange();
        }
    }


    async cancel() {
        try {
            if (this._sessionContainer) {
                this._sessionContainer.stop();
                if (this._deleteSessionOnCancel) {
                    await this._sessionContainer.deletSession();
                }
                this._sessionContainer = null;
            }
            if (this._waitHandle) {
                // rejects with AbortError
                this._waitHandle.dispose();
                this._waitHandle = null;
            }
            this._sessionCallback();
        } catch (err) {
            this._error = err;
            this.emitChange();
        }
    }

    // to show a spinner or not
    get loading() {
        return this._loading;
    }

    get loadLabel() {
        const sc = this._sessionContainer;
        const error = this._error || (sc && sc.loadError);

        if (error || (sc && sc.loadStatus.get() === LoadStatus.Error)) {
            return `Something went wrong: ${error && error.message}.`;
        }

        if (sc) {
            switch (sc.loadStatus.get()) {
                case LoadStatus.NotLoading:
                    return `Preparing…`;
                case LoadStatus.Login:
                    return `Checking your login and password…`;
                case LoadStatus.LoginFailed:
                    switch (sc.loginFailure) {
                        case LoginFailure.LoginFailure:
                            return `Your username and/or password don't seem to be correct.`;
                        case LoginFailure.Connection:
                            return `Can't connect to ${this._homeserver}.`;
                        case LoginFailure.Unknown:
                            return `Something went wrong while checking your login and password.`;
                    }
                    break;
                case LoadStatus.Loading:
                    return `Loading your conversations…`;
                case LoadStatus.FirstSync:
                    return `Getting your conversations from the server…`;
                default:
                    return this._sessionContainer.loadStatus.get();
            }
        }

        return `Preparing…`;
    }
}
