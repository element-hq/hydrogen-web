import { setAttribute, text, isChildren, classNames, TAG_NAMES } from "./html.js";
import {errorToDOM} from "./error.js";

function objHasFns(obj) {
    for(const value of Object.values(obj)) {
        if (typeof value === "function") {
            return true;
        }
    }
    return false;
}
/**
    Bindable template. Renders once, and allows bindings for given nodes. If you need
    to change the structure on a condition, use a subtemplate (if)

    supports
        - event handlers (attribute fn value with name that starts with on)
        - one way binding of attributes (other attribute fn value)
        - one way binding of text values (child fn value)
        - refs to get dom nodes
        - className binding returning object with className => enabled map
        - add subviews inside the template
*/
export class TemplateView {
    constructor(value, render = undefined) {
        this._value = value;
        this._render = render;
        this._eventListeners = null;
        this._bindings = null;
        // this should become _subViews and also include templates.
        // How do we know which ones we should update though?
        // Wrapper class?
        this._subViews = null;
        this._root = null;
        this._boundUpdateFromValue = null;
    }

    _subscribe() {
        this._boundUpdateFromValue = this._updateFromValue.bind(this);

        if (typeof this._value.on === "function") {
            this._value.on("change", this._boundUpdateFromValue);
        }
        else if (typeof this._value.subscribe === "function") {
            this._value.subscribe(this._boundUpdateFromValue);
        }
    }

    _unsubscribe() {
        if (this._boundUpdateFromValue) {
            if (typeof this._value.off === "function") {
                this._value.off("change", this._boundUpdateFromValue);
            }
            else if (typeof this._value.unsubscribe === "function") {
                this._value.unsubscribe(this._boundUpdateFromValue);
            }
            this._boundUpdateFromValue = null;
        }
    }

    _attach() {
        if (this._eventListeners) {
            for (let {node, name, fn} of this._eventListeners) {
                node.addEventListener(name, fn);
            }
        }
    }

    _detach() {
        if (this._eventListeners) {
            for (let {node, name, fn} of this._eventListeners) {
                node.removeEventListener(name, fn);
            }
        }
    }

    mount(options) {
        if (this._render) {
            this._root = this._render(this, this._value);
        } else if (this.render) {   // overriden in subclass
            this._root = this.render(this, this._value);
        }
        const parentProvidesUpdates = options && options.parentProvidesUpdates;
        if (!parentProvidesUpdates) {
            this._subscribe();
        }
        this._attach();
        return this._root;
    }

    unmount() {
        this._detach();
        this._unsubscribe();
        for (const v of this._subViews) {
            v.unmount();
        }
    }

    root() {
        return this._root;
    }

    _updateFromValue() {
        this.update(this._value);
    }

    update(value) {
        this._value = value;
        if (this._bindings) {
            for (const binding of this._bindings) {
                binding();
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

    _addSubView(view) {
        if (!this._subViews) {
            this._subViews = [];
        }
        this._subViews.push(view);
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
        if (attributes && isChildren(attributes)) {
            children = attributes;
            attributes = null;
        }

        const node = document.createElement(name);
        
        if (attributes) {
            this._setNodeAttributes(node, attributes);
        }
        if (children) {
            this._setNodeChildren(node, children);
        }

        return node;
    }

    _setNodeAttributes(node, attributes) {
        for(let [key, value] of Object.entries(attributes)) {
            const isFn = typeof value === "function";
            // binding for className as object of className => enabled
            if (key === "className" && typeof value === "object" && value !== null) {
                if (objHasFns(value)) {
                    this._addClassNamesBinding(node, value);
                } else {
                    setAttribute(node, key, classNames(value));
                }
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

    _setNodeChildren(node, children) {
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

    // this insert a view, and is not a view factory for `if`, so returns the root element to insert in the template
    // you should not call t.view() and not use the result (e.g. attach the result to the template DOM tree).
    view(view) {
        let root;
        try {
            root = view.mount();
        } catch (err) {
            return errorToDOM(err);
        }
        this._addSubView(view);
        return root;
    }

    // sugar
    createTemplate(render) {
        return vm => new TemplateView(vm, render);
    }

    // creates a conditional subtemplate
    if(fn, viewCreator) {
        const boolFn = value => !!fn(value);
        return this._addReplaceNodeBinding(boolFn, (prevNode) => {
            if (prevNode && prevNode.nodeType !== Node.COMMENT_NODE) {
                const viewIdx = this._subViews.findIndex(v => v.root() === prevNode);
                if (viewIdx !== -1) {
                    const [view] = this._subViews.splice(viewIdx, 1);
                    view.unmount();
                }
            }
            if (boolFn(this._value)) {
                const view = viewCreator(this._value);
                return this.view(view);
            } else {
                return document.createComment("if placeholder");
            }
        });
    }
}

for (const tag of TAG_NAMES) {
    TemplateView.prototype[tag] = function(attributes, children) {
        return this.el(tag, attributes, children);
    };
}

// TODO: should we an instance of something else than the view itself into the render method? That way you can't call template functions outside of the render method.
// methods that should be on the Template:
// el & all the tag names
// view
// if
// createTemplate
// 
// all the binding stuff goes on this class, we just set the bindings on the members of the view.
