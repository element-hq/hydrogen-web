import SimpleTile from "./SimpleTile.js";

export default class MessageTile extends SimpleTile {

    constructor(options) {
        super(options);
        this._isOwn = this._entry.sender === options.ownUserId;
        this._date = new Date(this._entry.timestamp);
        this._isContinuation = false;
    }

    get shape() {
        return "message";
    }

    get sender() {
        return this._entry.sender;
    }

    get date() {
        return this._date.toLocaleDateString({}, {month: "numeric", day: "numeric"});
    }

    get time() {
        return this._date.toLocaleTimeString({}, {hour: "numeric", minute: "2-digit"});
    }

    get isOwn() {
        return this._isOwn;
    }

    get isContinuation() {
        return this._isContinuation;
    }

    _getContent() {
        return this._entry.content;
    }

    updatePreviousSibling(prev) {
        super.updatePreviousSibling(prev);
        const isContinuation = prev && prev instanceof MessageTile && prev.sender === this.sender;
        if (isContinuation !== this._isContinuation) {
            this._isContinuation = isContinuation;
            this.emitUpdate("isContinuation");
        }
    }
}
