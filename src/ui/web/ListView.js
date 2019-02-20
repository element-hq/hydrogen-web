import * as html from "./html.js";

class UIView {
    mount(initialValue) {

    }

    unmount() {

    }

    update() {

    }
}

export default class ListView {
    constructor(collection, childCreator) {
        this._collection = collection;
        this._root = null;
        this._subscription = null;
        this._childCreator = childCreator;
        this._childInstances = null;
    }

    getDOMNode() {
        return this._root;
    }

    mount() {
        this._subscription = this._collection.subscribe(this);
        this._root = html.ul({className: "ListView"});
        this._childInstances = new Array(this._collection.length);
        for (let item of this._collection) {
            const child = this._childCreator(item);
            this._childInstances.push(child);
            const childDomNode = child.mount();
            this._root.appendChild(childDomNode);
        }
        return this._root;
    }

    unmount() {
        this._subscription = this._subscription();
        for (let child of this._childInstances) {
            child.unmount();
        }
        this._childInstances = null;
    }

    onAdd(i, value) {
        const child = this._childCreator(value);
        const childDomNode = child.mount();
        this._childInstances.splice(i, 0, child);
        const isLast =  i === this._collection.length - 1;
        if (isLast) {
            this._root.appendChild(childDomNode);
        } else {
            const nextDomNode = this._childInstances[i + 1].getDOMNode();
            this._root.insertBefore(childDomNode, nextDomNode);
        }

    }

    onRemove(i, _value) {
        const [child] = this._childInstances.splice(i, 1);
        child.getDOMNode().remove();
        child.unmount();
    }

    onMove(fromIdx, toIdx, value) {

    }

    onChange(i, value) {
        this._childInstances[i].update(value);
    }
}
