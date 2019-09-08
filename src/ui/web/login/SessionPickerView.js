import ListView from "../general/ListView.js";
import TemplateView from "../general/TemplateView.js";

class SessionPickerItem extends TemplateView {
    render(t) {
        return t.li([vm => vm.userId]);
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
