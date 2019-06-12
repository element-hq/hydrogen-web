import { setAttribute, text, TAG_NAMES } from "./html.js";

// const template = new Template(vm, t => {
//     return t.div({onClick: () => this._clicked(), className: "errorLabel"}, [
//         vm => vm.label,
//         t.span({className: vm => t.className({fatal: !!vm.fatal})}, [vm => vm.error])
//     ]);
// });

/*
    supports
        - event handlers (attribute fn value with name that starts with on)
        - one way binding of attributes (other attribute fn value)
        - one way binding of text values (child fn value)
        - refs to get dom nodes
        - className binding returning object with className => enabled map
    missing:
        - create views
*/
export default class Template {
    constructor(value, render) {
        this._value = value;
        this._refs = {};
        this._eventListeners = [];
        this._bindings = [];
        this._render = render;
    }

    className(obj) {
        Object.entries(obj).filter(([, value]) => value).map(([key]) => key).join(" ");
    }

    root() {
        if (!this._root) {
            this._root = this._render(this, this._value);
        }
        return this._root;
    }

    ref(name) {
        return this._refs[name];
    }

    update(value) {
        this._value = value;
        for (const binding of this._bindings) {
            binding();
        }
    }

    detach() {
        for (let {node, name, fn} of this._eventListeners) {
            node.removeEventListener(name, fn);
        }
    }

    attach() {
        for (let {node, name, fn} of this._eventListeners) {
            node.addEventListener(name, fn);
        }
    }

    _addRef(name, node) {
        this._refs[name] = node;
    }

    _addEventListener(node, name, fn) {
        this._eventListeners.push({node, name, fn});
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

    _addTextBinding(fn) {
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
        return node;
    }

    el(name, attributes, children) {
        if (attributes) {
            // valid attributes is only object that is not a DOM node
            // anything else (string, fn, array, dom node) is presumed
            // to be children with no attributes passed
            if (typeof attributes !== "object" || attributes.nodeType === Node.ELEMENT_NODE || Array.isArray(attributes)) {
                children = attributes;
                attributes = null;
            }
        }

        const node = document.createElement(name);

        if (attributes) {
            for(let [key, value] of Object.entries(attributes)) {
                const isFn = typeof value === "function";
                if (key === "ref") {
                    this._refs[value] = node;
                } else if (key.startsWith("on") && key.length > 2 && isFn) {
                    const eventName = key.substr(2, 1).toLowerCase() + key.substr(3);
                    const handler = value;
                    this._addEventListener(node, eventName, handler);
                } else if (isFn) {
                    this._addAttributeBinding(node, key, value);
                } else {
                    setAttribute(node, key, value);
                }
            }
        }

        if (children) {
            if (!Array.isArray(children)) {
                children = [children];
            }
            for (let child of children) {
                if (typeof child === "string") {
                    child = text(child);
                } else if (typeof c === "function") {
                    child = this._addTextBinding(child);
                }
                node.appendChild(child);
            }
        }

        return node;
    }
}

for (const tag of TAG_NAMES) {
    Template.prototype[tag] = function(...params) {
        this.el(tag, ... params);
    };
}
