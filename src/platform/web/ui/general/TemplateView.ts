/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2021 Daniel Fedorin <danila.fedorin@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { setAttribute, text, isChildren, classNames, TAG_NAMES, HTML_NS, ClassNames, Child as NonBoundChild} from "./html";
import {mountView} from "./utils";
import {BaseUpdateView, IObservableValue} from "./BaseUpdateView";
import {IMountArgs, ViewNode, IView} from "./types";

function objHasFns(obj: ClassNames<unknown>): obj is { [className: string]: boolean } {
    for(const value of Object.values(obj)) {
        if (typeof value === "function") {
            return true;
        }
    }
    return false;
}

export type RenderFn<T extends IObservableValue> = (t: Builder<T>, vm: T) => ViewNode;
type TextBinding<T extends IObservableValue> = (T) => string | number | boolean | undefined | null;
type Child<T extends IObservableValue> = NonBoundChild | TextBinding<T>;
type Children<T extends IObservableValue> = Child<T> | Child<T>[];
type EventHandler = ((event: Event) => void);
type AttributeStaticValue = string | boolean;
type AttributeBinding<T extends IObservableValue> = (value: T) => AttributeStaticValue;
export type AttrValue<T extends IObservableValue> = AttributeStaticValue | AttributeBinding<T> | EventHandler | ClassNames<T>;
export type Attributes<T extends IObservableValue> = { [attribute: string]: AttrValue<T> };
type ElementFn<T extends IObservableValue> = (attributes?: Attributes<T> | Children<T>, children?: Children<T>) => Element;
export type Builder<T extends IObservableValue> = TemplateBuilder<T> & { [tagName in typeof TAG_NAMES[string][number]]: ElementFn<T> };

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
// TODO: should we rename this to BoundView or something? As opposed to StaticView ...
export abstract class TemplateView<T extends IObservableValue> extends BaseUpdateView<T> {
    private _eventListeners?: { node: Element, name: string, fn: EventHandler, useCapture: boolean }[] = undefined;
    private _bindings?: (() => void)[] = undefined;
    private _root?: ViewNode = undefined;
    // public because used by TemplateBuilder
    _subViews?: IView[] = undefined;

    _attach(): void {
        if (this._eventListeners) {
            for (let {node, name, fn, useCapture} of this._eventListeners) {
                node.addEventListener(name, fn, useCapture);
            }
        }
    }

    _detach(): void {
        if (this._eventListeners) {
            for (let {node, name, fn, useCapture} of this._eventListeners) {
                node.removeEventListener(name, fn, useCapture);
            }
        }
    }

    abstract render(t: Builder<T>, value: T): ViewNode;

    mount(options?: IMountArgs): ViewNode {
        const builder = new TemplateBuilder(this) as Builder<T>;
        try {
            this._root = this.render(builder, this._value);
        } finally {
            builder.close();
        }
        // takes care of update being called when needed
        this.subscribeOnMount(options);
        this._attach();
        return this._root!;
    }

    unmount(): void {
        this._detach();
        super.unmount();
        if (this._subViews) {
            for (const v of this._subViews) {
                v.unmount();
            }
        }
    }

    root(): ViewNode | undefined {
        return this._root;
    }

    update(value: T, props?: string[]): void {
        this._value = value;
        if (this._bindings) {
            for (const binding of this._bindings) {
                binding();
            }
        }
    }

    _addEventListener(node: Element, name: string, fn: (event: Event) => void, useCapture: boolean = false): void {
        if (!this._eventListeners) {
            this._eventListeners = [];
        }
        this._eventListeners.push({node, name, fn, useCapture});
    }

    _addBinding(bindingFn: () => void): void {
        if (!this._bindings) {
            this._bindings = [];
        }
        this._bindings.push(bindingFn);
    }

    addSubView(view: IView): void {
        if (!this._subViews) {
            this._subViews = [];
        }
        this._subViews.push(view);
    }

    removeSubView(view: IView): void {
        if (!this._subViews) { return; }
        const idx = this._subViews.indexOf(view);
        if (idx !== -1) {
            this._subViews.splice(idx, 1);
        }
    }

    updateSubViews(value: IObservableValue, props: string[]) {
        if (this._subViews) {
            for (const v of this._subViews) {
                v.update(value, props);
            }
        }
    }
}

// what is passed to render
export class TemplateBuilder<T extends IObservableValue> {
    private _templateView: TemplateView<T>;
    private _closed: boolean = false;

    constructor(templateView: TemplateView<T>) {
        this._templateView = templateView;
    }

    close(): void {
        this._closed = true;
    }

    _addBinding(fn: () => void): void {
        if (this._closed) {
            console.trace("Adding a binding after render will likely cause memory leaks");
        }
        this._templateView._addBinding(fn);
    }

    get _value(): T {
        return this._templateView.value;
    }

    addEventListener(node: Element, name: string, fn: (event: Event) => void, useCapture: boolean = false): void {
        this._templateView._addEventListener(node, name, fn, useCapture);
    }

    _addAttributeBinding(node: Element, name: string, fn: AttributeBinding<T>): void {
        let prevValue: string | boolean | undefined = undefined;
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

    _addClassNamesBinding(node: Element, obj: ClassNames<T>): void {
        this._addAttributeBinding(node, "className", value => classNames(obj, value));
    }

    _addTextBinding(fn: (value: T) => ReturnType<TextBinding<T>>): Text {
        const initialValue = fn(this._value)+"";
        const node = text(initialValue);
        let prevValue = initialValue;
        const binding = () => {
            const newValue = fn(this._value)+"";
            if (prevValue !== newValue) {
                prevValue = newValue;
                node.textContent = newValue;
            }
        };

        this._addBinding(binding);
        return node;
    }

    _isEventHandler(key: string, value: AttrValue<T>): value is (event: Event) => void {
        // This isn't actually safe, but it's incorrect to feed event handlers to
        // non-on* attributes.
        return key.startsWith("on") && key.length > 2 && typeof value === "function";
    }

    _setNodeAttributes(node: Element, attributes: Attributes<T>): void {
        for(let [key, value] of Object.entries(attributes)) {
            // binding for className as object of className => enabled
            if (typeof value === "object") {
                if (key !== "className" || value === null) {
                    // Ignore non-className objects.
                    continue;
                }
                if (objHasFns(value)) {
                    this._addClassNamesBinding(node, value);
                } else {
                    setAttribute(node, key, classNames(value, this._value));
                }
            } else if (this._isEventHandler(key, value)) {
                const eventName = key.substr(2, 1).toLowerCase() + key.substr(3);
                const handler = value;
                this._templateView._addEventListener(node, eventName, handler);
            } else if (typeof value === "function") {
                this._addAttributeBinding(node, key, value);
            } else {
                setAttribute(node, key, value);
            }
        }
    }

    _setNodeChildren(node: Element, children: Children<T>): void{
        if (!Array.isArray(children)) {
            children = [children];
        }
        for (let child of children) {
            if (typeof child === "function") {
                child = this._addTextBinding(child);
            } else if (typeof child === "string") {
                // not a DOM node, turn into text
                child = text(child);
            }
            node.appendChild(child);
        }
    }
    
    _addReplaceNodeBinding<R>(fn: (value: T) => R, renderNode: (old: ViewNode | null) => ViewNode): ViewNode {
        let prevValue = fn(this._value);
        let node = renderNode(null);

        const binding = () => {
            const newValue = fn(this._value);
            if (prevValue !== newValue) {
                prevValue = newValue;
                const newNode = renderNode(node);
                if (node.parentNode) {
                    node.parentNode.replaceChild(newNode, node);
                }
                node = newNode;
            }
        };
        this._addBinding(binding);
        return node;
    }

    el(name: string, attributes?: Attributes<T> | Children<T>, children?: Children<T>): ViewNode {
        return this.elNS(HTML_NS, name, attributes, children);
    }

    elNS(ns: string, name: string, attributesOrChildren?: Attributes<T> | Children<T>, children?: Children<T>): ViewNode {
        let attributes: Attributes<T> | undefined;
        if (attributesOrChildren) {
            if (isChildren(attributesOrChildren)) {
                children = attributesOrChildren as Children<T>;
            } else {
                attributes = attributesOrChildren as Attributes<T>;
            }
        }

        const node = document.createElementNS(ns, name);
        
        if (attributes) {
            this._setNodeAttributes(node, attributes);
        }
        if (children) {
            this._setNodeChildren(node, children);
        }

        return node;
    }

    // this inserts a view, and is not a view factory for `if`, so returns the root element to insert in the template
    // you should not call t.view() and not use the result (e.g. attach the result to the template DOM tree).
    view(view: IView, mountOptions?: IMountArgs): ViewNode {
        this._templateView.addSubView(view);
        return mountView(view, mountOptions);
    }

    // map a value to a view, every time the value changes
    mapView<R>(mapFn: (value: T) => R, viewCreator: (mapped: R) => IView | null): ViewNode {
        return this._addReplaceNodeBinding(mapFn, (prevNode) => {
            if (prevNode && prevNode.nodeType !== Node.COMMENT_NODE) {
                const subViews = this._templateView._subViews;
                if (subViews) {
                    const viewIdx = subViews.findIndex(v => v.root() === prevNode);
                    if (viewIdx !== -1) {
                        const [view] = subViews.splice(viewIdx, 1);
                        view.unmount();
                    }
                }
            }
            const view = viewCreator(mapFn(this._value));
            if (view) {
                return this.view(view);
            } else {
                return document.createComment("node binding placeholder");
            }
        });
    }

    // Special case of mapView for a TemplateView.
    // Always creates a TemplateView, if this is optional depending
    // on mappedValue, use `if` or `mapView`
    map<R>(mapFn: (value: T) => R, renderFn: (mapped: R, t: Builder<T>, vm: T) => ViewNode | undefined): ViewNode {
        return this.mapView(mapFn, mappedValue => {
            return new InlineTemplateView(this._value, (t, vm) => {
                const rootNode = renderFn(mappedValue, t, vm);
                if (!rootNode) {
                    // TODO: this will confuse mapView which assumes that
                    // a comment node means there is no view to clean up
                    return document.createComment("map placeholder");
                }
                return rootNode;
            });
        });
    }

    ifView(predicate: (value: T) => boolean, viewCreator: (value: T) => IView): ViewNode {
        return this.mapView(
            value => !!predicate(value),
            enabled => enabled ? viewCreator(this._value) : null
        );
    }

    // creates a conditional subtemplate
    // use mapView if you need to map to a different view class
    if(predicate: (value: T) => boolean, renderFn: (t: Builder<T>, vm: T) => ViewNode) {
        return this.ifView(predicate, vm => new InlineTemplateView(vm, renderFn));
    }

    /** You probably are looking for something else, like map or mapView.
    This is an escape hatch that allows you to do manual DOM manipulations
    as a reaction to a binding change.
    This should only be used if the side-effect won't add any bindings,
    event handlers, ...
    You should not call the TemplateBuilder (e.g. `t.xxx()`) at all from the side effect,
    instead use tags from html.ts to help you construct any DOM you need. */
    mapSideEffect<R>(mapFn: (value: T) => R, sideEffect: (newV: R, oldV: R | undefined, value: T) => void) {
        let prevValue = mapFn(this._value);
        const binding = () => {
            const newValue = mapFn(this._value);
            if (prevValue !== newValue) {
                sideEffect(newValue, prevValue, this._value);
                prevValue = newValue;
            }
        };
        this._addBinding(binding);
        sideEffect(prevValue, undefined, this._value);
    }
}


for (const [ns, tags] of Object.entries(TAG_NAMES)) {
    for (const tag of tags) {
        TemplateBuilder.prototype[tag] = function(attributes, children) {
            return this.elNS(ns, tag, attributes, children);
        };
    }
}

export class InlineTemplateView<T extends IObservableValue> extends TemplateView<T> {
    private _render: RenderFn<T>;

    constructor(value: T, render: RenderFn<T>) {
        super(value);
        this._render = render;
    }

    override render(t: Builder<T>, value: T): ViewNode {
        return this._render(t, value);
    }
}
