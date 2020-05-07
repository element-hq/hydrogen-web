import {BaseObservableValue} from "../../../observable/ObservableValue.js";

export class OnlineStatus extends BaseObservableValue {
    constructor() {
        super();
        this._onOffline = this._onOffline.bind(this);
        this._onOnline = this._onOnline.bind(this);
    }

    _onOffline() {
        this.emit(false);
    }

    _onOnline() {
        this.emit(true);
    }

    get value() {
        return navigator.onLine;
    }

    onSubscribeFirst() {
        window.addEventListener('offline', this._onOffline);
        window.addEventListener('online', this._onOnline);
    }

    onUnsubscribeLast() {
        window.removeEventListener('offline', this._onOffline);
        window.removeEventListener('online', this._onOnline);
    }
}
