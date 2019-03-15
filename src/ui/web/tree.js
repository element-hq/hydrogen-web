import { setAttribute, addChildren, text } from "./html.js";

function renderTree() {}


const tree = renderTree(vm, t => {
    return t.div({onClick: () => this._clicked(), className: "errorLabel"}, [
        vm => vm.label,
        t.span({className: vm => {{fatal: !!vm.fatal}}}, [vm => vm.error])
    ]);
});

tree.root
tree.detach()
tree.updateBindings(vm);




class Tree {
    constructor(value, render) {
        this._ctx = new TreeContext(value);
        this._root = render(this._ctx);
    }

    ref(name) {
        return this._ctx._refs[name];
    }

    detach() {
        for (let {node, name, fn} of this._ctx._eventListeners) {
            node.removeEventListener(name, fn);
        }
    }
}

class TreeContext {
    constructor(value) {
        this._value = value;
        this._refs = {};
        this._eventListeners = [];
        this._bindings = [];
    }

    _addRef(name, node) {
        this._refs[name] = node;
    }

    _addEventListener(node, name, fn) {
        node.addEventListener(name, fn);
        this._eventListeners.push({node, event, fn});
    }

    _setAttributeBinding(node, name, fn) {
        let prevValue = undefined;
        const binding = () => {
            const newValue = fn(this._value);
            if (prevValue !== newValue) {
                prevValue = newValue;
                setAttribute(node, name, newValue);
            }
        };
        this._bindings.push(binding);
        binding();
    }

    _setTextBinding(fn) {
        const initialValue = fn(this._value);
        const node = text(initialValue);
        let prevValue = initialValue;
        const binding = () => {
            const newValue = fn(this._value);
            if (prevValue !== newValue) {
                prevValue = newValue;
                node.textContent = newValue+"";
            }
        };
        this._bindings.push(binding);
    }

    el(name, attributes, children) {
        const node = document.createElement(name);
        for(let [key, value] of Object.entries(attributes)) {
            const isFn = typeof value === "function";
            if (key.startsWith("on") && key.length > 2 && isFn) {
                const eventName = key.substr(2, 1).toLowerCase() + key.substr(3);
                const handler = value;
                this._addEventListener(node, eventName, handler);
            } else if (isFn) {
                this._addAttributeBinding(node, key, value);
            } else {
                setAttribute(node, key, value);
            }
        }

        addChildren(node, children);
        return node;
    }

    ol(... params)      { return this.el("ol", ... params); }
    ul(... params)      { return this.el("ul", ... params); }
    li(... params)      { return this.el("li", ... params); }
    div(... params)     { return this.el("div", ... params); }
    h1(... params)      { return this.el("h1", ... params); }
    h2(... params)      { return this.el("h2", ... params); }
    h3(... params)      { return this.el("h3", ... params); }
    h4(... params)      { return this.el("h4", ... params); }
    h5(... params)      { return this.el("h5", ... params); }
    h6(... params)      { return this.el("h6", ... params); }
    p(... params)       { return this.el("p", ... params); }
    strong(... params)  { return this.el("strong", ... params); }
    em(... params)      { return this.el("em", ... params); }
    span(... params)    { return this.el("span", ... params); }
    img(... params)     { return this.el("img", ... params); }
    section(... params) { return this.el("section", ... params); }
    main(... params)    { return this.el("main", ... params); }
    article(... params) { return this.el("article", ... params); }
    aside(... params)   { return this.el("aside", ... params); }
    pre(... params)     { return this.el("pre", ... params); }
}
