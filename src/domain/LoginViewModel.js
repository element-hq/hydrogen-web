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

    // TODO: this will need to support binding
    // if any of the expr is a function, assume the function is a binding, and return a binding function ourselves
    i18n(parts, ...expr) {
        // just concat for now
        let result = "";
        for (let i = 0; i < parts.length; ++i) {
            result = result + parts[i];
            if (i < expr.length) {
                result = result + expr[i];
            }
        }
        return result;
    }

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
