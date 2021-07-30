export class LoginMethod {
    constructor({homeServer, platform}) {
        this.homeServer = homeServer;
        this._platform = platform;
    }

    // eslint-disable-next-line no-unused-vars
    async login(hsApi, deviceName) {
        throw("Not Implemented");
    }
}
