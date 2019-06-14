import TimelineTile from "./TimelineTile.js";
import ListView from "./ListView.js";
import {tag} from "./html.js";
import GapView from "./timeline/GapView.js";

export default class RoomView {
    constructor(viewModel) {
        this._viewModel = viewModel;
        this._root = null;
        this._timelineList = null;
        this._nameLabel = null;
        this._onViewModelUpdate = this._onViewModelUpdate.bind(this);
    }

    mount() {
        this._viewModel.on("change", this._onViewModelUpdate);
        this._nameLabel = tag.h2(null, this._viewModel.name);
        this._errorLabel = tag.div({className: "RoomView_error"});

        this._timelineList = new ListView({}, entry => {
            return entry.shape === "gap" ? new GapView(entry) : new TimelineTile(entry);
        });
        this._timelineList.mount();

        this._root = tag.div({className: "RoomView"}, [
            this._nameLabel,
            this._errorLabel,
            this._timelineList.root()
        ]);

        return this._root;
    }

    unmount() {
        this._timelineList.unmount();
        this._viewModel.off("change", this._onViewModelUpdate);
    }

    root() {
        return this._root;
    }

    _onViewModelUpdate(prop) {
        if (prop === "name") {
            this._nameLabel.innerText = this._viewModel.name;
        }
        else if (prop === "timelineViewModel") {
            this._timelineList.update({list: this._viewModel.timelineViewModel.tiles});
        } else if (prop === "error") {
            this._errorLabel.innerText = this._viewModel.error;
        }
    }

    update() {}
}
