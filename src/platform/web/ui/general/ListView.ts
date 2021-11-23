/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {el} from "./html";
import {mountView, insertAt} from "./utils";
import {SubscriptionHandle} from "../../../../observable/BaseObservable";
import {BaseObservableList as ObservableList, IListObserver} from "../../../../observable/list/BaseObservableList";
import {IView, IMountArgs} from "./types";

export interface IOptions<T, V> {
    list: ObservableList<T>,
    onItemClick?: (childView: V, evt: UIEvent) => void,
    className?: string,
    tagName?: string,
    parentProvidesUpdates?: boolean
}

export class ListView<T, V extends IView> implements IView, IListObserver<T> {

    private _onItemClick?: (childView: V, evt: UIEvent) => void;
    private _className?: string;
    private _tagName: string;
    private _root?: Element;
    protected _subscription?: SubscriptionHandle;
    protected _childCreator: (value: T) => V;
    protected _mountArgs: IMountArgs;
    protected _list: ObservableList<T>;
    protected _childInstances?: V[];

    constructor(
        {list, onItemClick, className, tagName = "ul", parentProvidesUpdates = true}: IOptions<T, V>, 
        childCreator: (value: T) => V
    ) {
        this._onItemClick = onItemClick;
        this._list = list;
        this._className = className;
        this._tagName = tagName;
        this._root = undefined;
        this._subscription = undefined;
        this._childCreator = childCreator;
        this._childInstances = undefined;
        this._mountArgs = {parentProvidesUpdates};
    }

    root(): Element | undefined {
        // won't be undefined when called between mount and unmount
        return this._root;
    }

    update(attributes: IOptions<T, V>) {
        if (attributes.list) {
            if (this._subscription) {
                this._unloadList();
                while (this._root!.lastChild) {
                    this._root!.lastChild.remove();
                }
            }
            this._list = attributes.list;
            this.loadList();
        }
    }

    mount(): Element {
        const attr: {[name: string]: any} = {};
        if (this._className) {
            attr.className = this._className;
        }
        const root = this._root = el(this._tagName, attr);
        this.loadList();
        if (this._onItemClick) {
            root.addEventListener("click", this);
        }
        return root;
    }

    handleEvent(evt: Event) {
        if (evt.type === "click") {
            this._handleClick(evt as UIEvent);
        }
    }

    unmount(): void {
        if (this._list) {
            this._unloadList();
        }
    }

    private _handleClick(event: UIEvent) {
        if (event.target === this._root || !this._onItemClick) {
            return;
        }
        let childNode = event.target as Element;
        while (childNode.parentNode !== this._root) {
            childNode = childNode.parentNode as Element;
        }
        const index = Array.prototype.indexOf.call(this._root!.childNodes, childNode);
        const childView = this._childInstances![index];
        if (childView) {
            this._onItemClick(childView, event);
        }
    }

    private _unloadList() {
        this._subscription = this._subscription!();
        for (let child of this._childInstances!) {
            child.unmount();
        }
        this._childInstances = undefined;
    }

    protected loadList() {
        if (!this._list) {
            return;
        }
        this._subscription = this._list.subscribe(this);
        this._childInstances = [];
        const fragment = document.createDocumentFragment();
        for (let item of this._list) {
            const child = this._childCreator(item);
            this._childInstances!.push(child);
            fragment.appendChild(mountView(child, this._mountArgs));
        }
        this._root!.appendChild(fragment);
    }

    onReset() {
        for (const child of this._childInstances!) {
            child.root()!.remove();
            child.unmount();
        }
        this._childInstances!.length = 0;
    }

    onAdd(idx: number, value: T) {
        this.addChild(idx, value);
    }

    onRemove(idx: number, value: T) {
        this.removeChild(idx);
    }

    onMove(fromIdx: number, toIdx: number, value: T) {
        this.moveChild(fromIdx, toIdx);
    }

    onUpdate(i: number, value: T, params: any) {
        this.updateChild(i, value, params);
    }

    protected addChild(childIdx: number, value: T) {
        const child = this._childCreator(value);
        this._childInstances!.splice(childIdx, 0, child);
        insertAt(this._root!, childIdx, mountView(child, this._mountArgs));
    }

    protected removeChild(childIdx: number) {
        const [child] = this._childInstances!.splice(childIdx, 1);
        child.root()!.remove();
        child.unmount();
    }

    protected moveChild(fromChildIdx: number, toChildIdx: number) {
        const [child] = this._childInstances!.splice(fromChildIdx, 1);
        this._childInstances!.splice(toChildIdx, 0, child);
        child.root()!.remove();
        insertAt(this._root!, toChildIdx, child.root()! as Element);
    }

    protected updateChild(childIdx: number, value: T, params: any) {
        if (this._childInstances) {
            const instance = this._childInstances![childIdx];
            instance && instance.update(value, params);
        }
    }

    // TODO: is this the list or view index? 
    protected recreateItem(index: number, value: T) {
        if (this._childInstances) {
            const child = this._childCreator(value);
            if (!child) {
                this.onRemove(index, value);
            } else {
                const [oldChild] = this._childInstances!.splice(index, 1, child);
                this._root!.replaceChild(child.mount(this._mountArgs), oldChild.root()!);
                oldChild.unmount();
            }
        }
    }

    public getChildInstanceByIndex(idx: number): V | undefined {
        return this._childInstances?.[idx];
    }
}
