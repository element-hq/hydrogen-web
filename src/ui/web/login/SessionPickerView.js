import * as h from "../general/html.js";
import ListView from "../general/ListView.js";

class SessionPickerItem {

}

export default class SessionPickerView extends TemplateView {
    mount() {
        this._sessionList = new ListView({list: this._viewModel.sessions}, sessionInfo => {
            return new SessionPickerItem(sessionInfo);
        });
        super.mount();
    }

    render(t, vm) {
        this._root = h.div({className: "SessionPickerView"}, [
            this._sessionList.mount(),
            h.button()
        ]);

    }

    unmount() {
        super.unmount();
        this._sessionList.unmount();
    }
}
