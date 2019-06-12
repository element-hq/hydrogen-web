import Template from "./Template.js";

export default class TemplateView {
    constructor(value) {
        this._template = new Template(value, (t, value) => this.render(t, value));
    }

    render() {
        throw new Error("render not implemented");
    }

    mount() {
        const root = this._template.root();
        this._template.attach();
        return root;
    }

    root() {
        return this._template.root();
    }

    unmount() {
        this._template.detach();
    }

    update(value) {
        this._template.update(value);
    }
}
