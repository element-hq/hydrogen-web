export class PendingEvent {
    constructor(data) {
        this._data = data;
    }

    get roomId() { return this._data.roomId; }
    get queueIndex() { return this._data.queueIndex; }
    get eventType() { return this._data.eventType; }
    get txnId() { return this._data.txnId; }
    get remoteId() { return this._data.remoteId; }
    set remoteId(value) { this._data.remoteId = value; }
    get content() { return this._data.content; }
    get data() { return this._data; }
}
