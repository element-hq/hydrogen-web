export default class User {
    constructor(userId) {
        this._userId = userId;
    }

    get id() {
        return this._userId;
    }
}
