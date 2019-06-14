import Template from "./Template.js";

export default class TemplateView {
    constructor(value) {
        this.viewModel = value;
        this._template = null;
    }

    render() {
        throw new Error("render not implemented");
    }

    mount() {
        this._template = new Template(this.viewModel, (t, value) => this.render(t, value));
        return this.root();
    }

    root() {
        return this._template.root();
    }

    unmount() {
        this._template.dispose();
        this._template = null;
    }

    update(value) {
        this._template.update(value);
    }
}
