import { LoginMethod } from "./LoginMethod.js";

export class PasswordLoginMethod extends LoginMethod {
    constructor(options) {
        super(options);
        this.username = options.username;
        this.password = options.password;
    }

    async login(hsApi, deviceName) {
        return this._platform.logger.run("passwordLogin", async log => 
            await hsApi.passwordLogin(this.username, this.password, deviceName, {log}).response()
        );
    }
}
