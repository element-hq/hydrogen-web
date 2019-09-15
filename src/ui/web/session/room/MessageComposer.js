import TemplateView from "../../general/TemplateView.js";

export default class MessageComposer extends TemplateView {
    constructor(viewModel) {
        super(viewModel);
        this._input = null;
    }

    render(t) {
        this._input = t.input({
            placeholder: "Send a message ...",
            onKeydown: e => this._onKeyDown(e)
        });
        return t.div({className: "MessageComposer"}, [this._input]);
    }

    _onKeyDown(event) {
        if (event.key === "Enter") {
            if (this.viewModel.sendMessage(this._input.value)) {
                this._input.value = "";
            }
        }
    }
}
