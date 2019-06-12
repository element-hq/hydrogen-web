import TemplateView from "./TemplateView.js";

export default class RoomTile extends TemplateView {
    render(t) {
        return t.li(vm => vm.name);
    }

    // called from ListView
    clicked() {
        this._viewModel.open();
    }
}
