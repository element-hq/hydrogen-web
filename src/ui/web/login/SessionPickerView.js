import ListView from "../general/ListView.js";
import TemplateView from "../general/TemplateView.js";

class SessionPickerItem extends TemplateView {
    constructor(vm) {
        super(vm, true);
        this._onDeleteClick = this._onDeleteClick.bind(this);
    }

    _onDeleteClick(event) {
        event.stopPropagation();
        event.preventDefault();
        this.viewModel.delete();
    }

    render(t) {
        const deleteButton = t.button({
            disabled: vm => vm.isDeleting,
            onClick: event => this._onDeleteClick(event)
        }, "Delete");
        const userName = t.span({className: "userId"}, vm => vm.userId);
        const errorMessage = t.if(vm => vm.error, t => t.span({className: "error"}, vm => vm.error));
        return t.li([userName, errorMessage, deleteButton]);
    }
}

export default class SessionPickerView extends TemplateView {
    mount() {
        this._sessionList = new ListView({
            list: this.viewModel.sessions,
            onItemClick: (item) => {
                this.viewModel.pick(item.viewModel.id);
            },
        }, sessionInfo => {
            return new SessionPickerItem(sessionInfo);
        });
        return super.mount();
    }

    render(t) {
        return t.div({className: "SessionPickerView"}, [
            t.h1(["Pick a session"]),
            this._sessionList.mount(),
            t.button({onClick: () => this.viewModel.cancel()}, ["Log in to a new session instead"])
        ]);
    }

    unmount() {
        super.unmount();
        this._sessionList.unmount();
    }
}
