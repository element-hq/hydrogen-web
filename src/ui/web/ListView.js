import * as html from "./html.js";

class UIView {
    mount() {}
    unmount() {}
    update(_value) {}
    // can only be called between a call to mount and unmount
    root() {}
}

function insertAt(parentNode, idx, childNode) {
    const isLast =  idx === parentNode.childElementCount - 1;
    if (isLast) {
        parentNode.appendChild(childNode);
    } else {
        const nextDomNode = parentNode.children[idx + 1];
        parentNode.insertBefore(childNode, nextDomNode);
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

    root() {
        return this._root;
    }

    update() {}

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

    onAdd(idx, value) {
        const child = this._childCreator(value);
        this._childInstances.splice(idx, 0, child);
        insertAt(this._root, idx, child.mount());
    }

    onRemove(idx, _value) {
        const [child] = this._childInstances.splice(idx, 1);
        child.root().remove();
        child.unmount();
    }

    onMove(fromIdx, toIdx, value) {
        const [child] = this._childInstances.splice(fromIdx, 1);
        this._childInstances.splice(toIdx, 0, child);
        child.root().remove();
        insertAt(this._root, toIdx, child.root());
    }

    onUpdate(i, value) {
        this._childInstances[i].update(value);
    }
}
