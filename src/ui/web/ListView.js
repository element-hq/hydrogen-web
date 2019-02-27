import * as html from "./html.js";

class UIView {
    mount() {}
    unmount() {}
    update(_value) {}
    // can only be called between a call to mount and unmount
    root() {}
}

function insertAt(parentNode, idx, childNode) {
    const isLast = idx === parentNode.childElementCount;
    if (isLast) {
        parentNode.appendChild(childNode);
    } else {
        const nextDomNode = parentNode.children[idx];
        parentNode.insertBefore(childNode, nextDomNode);
    }
}

export default class ListView {
    constructor({list, onItemClick}, childCreator) {
        this._onItemClick = onItemClick;
        this._list = list;
        this._root = null;
        this._subscription = null;
        this._childCreator = childCreator;
        this._childInstances = null;
        this._onClick = this._onClick.bind(this);
    }

    root() {
        return this._root;
    }

    update(attributes) {
        if (attributes.hasOwnProperty("list")) {
            if (this._subscription) {
                this._unloadList();
                while (this._root.lastChild) {
                    this._root.lastChild.remove();
                }
            }
            this._list = attributes.list;
            this._loadList();
        }
    }

    mount() {
        this._root = html.ul({className: "ListView"});
        this._loadList();
        if (this._onItemClick) {
            this._root.addEventListener("click", this._onClick);
        }
        return this._root;
    }

    unmount() {
        this._unloadList();
    }

    _onClick(event) {
        let childNode = event.target;
        while (childNode.parentNode !== this._root) {
            childNode = childNode.parentNode;
        }
        const index = Array.prototype.indexOf.call(this._root.childNodes, childNode);
        const childView = this._childInstances[index];
        this._onItemClick(childView, event);
    }

    _unloadList() {
        this._subscription = this._subscription();
        for (let child of this._childInstances) {
            child.unmount();
        }
        this._childInstances = null;
    }

    _loadList() {
        if (!this._list) {
            return;
        }
        this._subscription = this._list.subscribe(this);
        this._childInstances = [];
        for (let item of this._list) {
            const child = this._childCreator(item);
            this._childInstances.push(child);
            const childDomNode = child.mount();
            this._root.appendChild(childDomNode);
        }
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

    onUpdate(i, value, params) {
        this._childInstances[i].update(value, params);
    }
}
