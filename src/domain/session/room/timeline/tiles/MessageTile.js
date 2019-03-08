import SimpleTile from "./SimpleTile.js";

export default class MessageTile extends SimpleTile {

    constructor(options) {
        super(options);
        this._date = new Date(this._entry.event.origin_server_ts);
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

    _getContent() {
        const event = this._entry.event;
        return event && event.content;
    }
}
