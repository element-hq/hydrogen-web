export default class PendingEvent {
    constructor(roomId, queueIndex, eventType, content, txnId) {
        this._roomId = roomId;
        this._eventType = eventType;
        this._content = content;
        this._txnId = txnId;
        this._queueIndex = queueIndex;
    }


}
