export class LoginMethod {
    constructor({homeServer, platform}) {
        this.homeServer = homeServer;
        this._platform = platform;
    }

    async login(hsApi, deviceName) {
        throw("Not Implemented");
    }
}
