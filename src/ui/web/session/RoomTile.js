import TemplateView from "../general/TemplateView.js";

export default class RoomTile extends TemplateView {
    render(t) {
        return t.li([
            t.div({className: "avatar medium"}, vm => vm.avatarInitials),
            t.div({className: "description"}, t.div({className: "name"}, vm => vm.name))
        ]);
    }

    // called from ListView
    clicked() {
        this.viewModel.open();
    }
}
