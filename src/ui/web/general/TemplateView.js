import Template from "./Template.js";

export default class TemplateView {
    constructor(vm, bindToChangeEvent) {
        this.viewModel = vm;
        this._changeEventHandler = bindToChangeEvent ? this.update.bind(this, this.viewModel) : null;
        this._template = null;
    }

    render() {
        throw new Error("render not implemented");
    }

    mount() {
        if (this._changeEventHandler) {
            this.viewModel.on("change", this._changeEventHandler);
        }
        this._template = new Template(this.viewModel, (t, value) => this.render(t, value));
        return this.root();
    }

    root() {
        return this._template.root();
    }

    unmount() {
        if (this._changeEventHandler) {
            this.viewModel.off("change", this._changeEventHandler);
        }
        this._template.dispose();
        this._template = null;
    }

    update(value, prop) {
        this._template.update(value);
    }
}
