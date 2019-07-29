import EventEmitter from "../EventEmitter.js";

export default class LoginViewModel extends EventEmitter {
    constructor({loginCallback, defaultHomeServer, createHsApi}) {
        super();
        this._loginCallback = loginCallback;
        this._defaultHomeServer = defaultHomeServer;
        this._createHsApi = createHsApi;
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
        const hsApi = this._createHsApi(homeserver);
        try {
            this._loading = true;
            this.emit("change", "loading");
            const loginData = await hsApi.passwordLogin(username, password).response();
            this._loginCallback(loginData);
            // wait for parent view model to switch away here
        } catch (err) {
            this._error = err;
            this._loading = false;
            this.emit("change", "loading");
        }
    }

    cancel() {
        this._loginCallback();
    }
}
