

export default class Direction {
    constructor(isForward) {
        this._isForward = isForward;
    }

    get isForward() {
        return this._isForward;
    }

    get isBackward() {
        return !this.isForward;
    }

    asApiString() {
        return this.isForward ? "f" : "b";
    }

    static get Forward() {
        return _forward;
    }

    static get Backward() {
        return _backward;
    }
}

const _forward = Object.freeze(new Direction(true));
const _backward = Object.freeze(new Direction(false));
