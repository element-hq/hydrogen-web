import { setAttribute, text, TAG_NAMES } from "./html.js";


function classNames(obj, value) {
    return Object.entries(obj).reduce((cn, [name, enabled]) => {
        if (typeof enabled === "function") {
            enabled = enabled(value);
        }
        if (enabled) {
            return (cn.length ? " " : "") + name;
        } else {
            return cn;
        }
    }, "");
}
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
        this._eventListeners = null;
        this._bindings = null;
        this._subTemplates = null;
        this._root = render(this, this._value);
        this._attach();
    }

    root() {
        return this._root;
    }

    update(value) {
        this._value = value;
        if (this._bindings) {
            for (const binding of this._bindings) {
                binding();
            }
        }
        if (this._subTemplates) {
            for (const sub of this._subTemplates) {
                sub.update(value);
            }
        }
    }

    dispose() {
        if (this._eventListeners) {
            for (let {node, name, fn} of this._eventListeners) {
                node.removeEventListener(name, fn);
            }
        }
        if (this._subTemplates) {
            for (const sub of this._subTemplates) {
                sub.dispose();
            }
        }
    }

    _attach() {
        if (this._eventListeners) {
            for (let {node, name, fn} of this._eventListeners) {
                node.addEventListener(name, fn);
            }
        }
    }

    _addEventListener(node, name, fn) {
        if (!this._eventListeners) {
            this._eventListeners = [];
        }
        this._eventListeners.push({node, name, fn});
    }

    _addBinding(bindingFn) {
        if (!this._bindings) {
            this._bindings = [];
        }
        this._bindings.push(bindingFn);
    }

    _addSubTemplate(t) {
        if (!this._subTemplates) {
            this._subTemplates = [];
        }
        this._subTemplates.push(t);
    }

    _addAttributeBinding(node, name, fn) {
        let prevValue = undefined;
        const binding = () => {
            const newValue = fn(this._value);
            if (prevValue !== newValue) {
                prevValue = newValue;
                setAttribute(node, name, newValue);
            }
        };
        this._addBinding(binding);
        binding();
    }

    _addClassNamesBinding(node, obj) {
        this._addAttributeBinding(node, "className", value => classNames(obj, value));
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

        this._addBinding(binding);
        return node;
    }

    el(name, attributes, children) {
        if (attributes) {
            // valid attributes is only object that is not a DOM node
            // anything else (string, fn, array, dom node) is presumed
            // to be children with no attributes passed
            if (typeof attributes !== "object" || !!attributes.nodeType || Array.isArray(attributes)) {
                children = attributes;
                attributes = null;
            }
        }

        const node = document.createElement(name);

        if (attributes) {
            for(let [key, value] of Object.entries(attributes)) {
                const isFn = typeof value === "function";
                // binding for className as object of className => enabled
                if (key === "className" && typeof value === "object" && value !== null) {
                    this._addClassNamesBinding(node, value);
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
                if (typeof child === "function") {
                    child = this._addTextBinding(child);
                } else if (!child.nodeType) {
                    // not a DOM node, turn into text
                    child = text(child);
                }
                node.appendChild(child);
            }
        }

        return node;
    }

    _addReplaceNodeBinding(fn, renderNode) {
        let prevValue = fn(this._value);
        let node = renderNode(null);

        const binding = () => {
            const newValue = fn(this._value);
            if (prevValue !== newValue) {
                prevValue = newValue;
                const newNode = renderNode(node);
                if (node.parentElement) {
                    node.parentElement.replaceChild(newNode, node);
                }
                node = newNode;
            }
        };
        this._addBinding(binding);
        return node;
    }

    // creates a conditional subtemplate
    if(fn, render) {
        const boolFn = value => !!fn(value);
        return this._addReplaceNodeBinding(boolFn, (prevNode) => {
            if (prevNode && prevNode.nodeType !== Node.COMMENT_NODE) {
                const templateIdx = this._subTemplates.findIndex(t => t.root() === prevNode);
                const [template] = this._subTemplates.splice(templateIdx, 1);
                template.dispose();
            }
            if (boolFn(this._value)) {
                const template = new Template(this._value, render);
                this._addSubTemplate(template);
                return template.root();
            } else {
                return document.createComment("if placeholder");
            }
        });
    }
}

for (const tag of TAG_NAMES) {
    Template.prototype[tag] = function(...params) {
        return this.el(tag, ... params);
    };
}
