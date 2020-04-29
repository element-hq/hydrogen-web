import {EventEmitter} from "../utils/EventEmitter.js";
import {SessionLoadViewModel} from "./SessionLoadViewModel.js";

export class LoginViewModel extends EventEmitter {
    constructor({sessionCallback, defaultHomeServer, createSessionContainer}) {
        super();
        this._createSessionContainer = createSessionContainer;
        this._sessionCallback = sessionCallback;
        this._defaultHomeServer = defaultHomeServer;
        this._loadViewModel = null;
    }

    get usernamePlaceholder() { return "Username"; }
    get passwordPlaceholder() { return "Password"; }
    get hsPlaceholder() { return "Your matrix homeserver"; }
    get defaultHomeServer() { return this._defaultHomeServer; }

    get loadViewModel() {return this._loadViewModel; }

    async login(username, password, homeserver) {
        this._loadViewModel = new SessionLoadViewModel({
            createAndStartSessionContainer: () => {
                const sessionContainer = this._createSessionContainer();
                sessionContainer.startWithLogin(homeserver, username, password);
                return sessionContainer;
            },
            sessionCallback: sessionContainer => {
                if (sessionContainer) {
                    // make parent view model move away
                    this._sessionCallback(sessionContainer);
                } else {
                    // show list of session again
                    this._loadViewModel = null;
                    this.emit("change", "loadViewModel");
                }
            },
            deleteSessionOnCancel: true,
            homeserver,
        });
        this._loadViewModel.start();
        this.emit("change", "loadViewModel");
    }

    cancel() {
        if (!this._loadViewModel) {
            this._sessionCallback();
        }
    }
}
