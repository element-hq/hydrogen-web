import EventEmitter from "../../EventEmitter.js";
import RoomTileViewModel from "./roomlist/RoomTileViewModel.js";
import RoomViewModel from "./room/RoomViewModel.js";
import SyncStatusViewModel from "./SyncStatusViewModel.js";

export default class SessionLoadViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._sessionContainer = options.sessionContainer;
        this._updateState();
    }

    onSubscribeFirst() {
        this.track(this._sessionContainer.subscribe(this._updateState));
    }

    _updateState(previousState) {
        const state = this._sessionContainer.state;
        if (previousState !== LoadState.Ready && state === LoadState.Ready) {
            this._sessionViewModel = new SessionViewModel(this.childOptions({
                sessionContainer: this._sessionContainer
            }));
            this.track(this._sessionViewModel);
        } else if (previousState === LoadState.Ready && state !== LoadState.Ready) {
            this.disposables.disposeTracked(this._sessionViewModel);
            this._sessionViewModel = null;
        }
        this.emit();
    }

    get isLoading() {
        const state = this._sessionContainer.state;
        return state === LoadState.Loading || state === LoadState.InitialSync;
    }

    get loadingLabel() {
        switch (this._sessionContainer.state) {
            case LoadState.Loading: return "Loading your conversations…";
            case LoadState.InitialSync: return "Getting your conversations from the server…";
            default: return null;
        }
    }
}
