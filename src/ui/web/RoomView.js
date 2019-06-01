import TimelineTile from "./TimelineTile.js";
import ListView from "./ListView.js";
import * as html from "./html.js";

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
        this._nameLabel = html.h2(null, this._viewModel.name);
        this._timelineList = new ListView({}, entry => new TimelineTile(entry));
        this._timelineList.mount();

        this._root = html.div({className: "RoomView"}, [
            this._nameLabel,
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
        }
    }

    update() {}
}
