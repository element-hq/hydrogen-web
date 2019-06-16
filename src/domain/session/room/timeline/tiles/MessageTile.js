import SimpleTile from "./SimpleTile.js";

export default class MessageTile extends SimpleTile {

    constructor(options) {
        super(options);
        this._isOwn = this._entry.event.sender === options.ownUserId;
        this._date = new Date(this._entry.event.origin_server_ts);
    }

    get shape() {
        return "message";
    }

    get sender() {
        return this._entry.event.sender;
    }

    get date() {
        return this._date.toLocaleDateString();
    }

    get time() {
        return this._date.toLocaleTimeString();
    }

    get isOwn() {
        return this._isOwn;
    }

    _getContent() {
        const event = this._entry.event;
        return event && event.content;
    }
}
