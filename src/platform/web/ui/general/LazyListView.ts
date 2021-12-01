/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {tag} from "./html";
import {removeChildren, mountView} from "./utils";
import {ListRange, ResultType, AddRemoveResult} from "./ListRange";
import {ListView, IOptions as IParentOptions} from "./ListView";
import {IView} from "./types";

export interface IOptions<T, V> extends IParentOptions<T, V> {
    itemHeight: number;
    overflowItems?: number;
}

export class LazyListView<T, V extends IView> extends ListView<T, V> {
    private renderRange?: ListRange;
    private height?: number;
    private itemHeight: number;
    private overflowItems: number;
    private scrollContainer?: HTMLElement;

    constructor(
        {itemHeight, overflowItems = 20, ...options}: IOptions<T, V>, 
        childCreator: (value: T) => V
    ) {
        super(options, childCreator);
        this.itemHeight = itemHeight;
        this.overflowItems = overflowItems;
    }

    handleEvent(e: Event) {
        if (e.type === "scroll") {
            this.handleScroll();
        } else {
            super.handleEvent(e);
        }
    }

    handleScroll() {
        const visibleRange = this._getVisibleRange();
        // don't contain empty ranges
        // as it will prevent clearing the list
        // once it is scrolled far enough out of view
        if (visibleRange.length !== 0 && !this.renderRange!.contains(visibleRange)) {
            const prevRenderRange = this.renderRange!;
            this.renderRange = visibleRange.expand(this.overflowItems);
            this.renderUpdate(prevRenderRange, this.renderRange);
        }
    }
    
    // override
    async loadList() {
        /*
        Wait two frames for the return from mount() to be inserted into DOM.
        This should be enough, but if this gives us trouble we can always use
        MutationObserver.
        */
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));

        if (!this._list) {
            return;
        }
        this._subscription = this._list.subscribe(this);
        const visibleRange = this._getVisibleRange();
        this.renderRange = visibleRange.expand(this.overflowItems);
        this._childInstances = [];
        this.reRenderFullRange(this.renderRange);
    }

    private _getVisibleRange() {
        const {clientHeight, scrollTop} = this.root()!;
        if (clientHeight === 0) {
            throw new Error("LazyListView height is 0");
        }
        return ListRange.fromViewport(this._list.length, this.itemHeight, clientHeight, scrollTop);
    }

    private reRenderFullRange(range: ListRange) {
        removeChildren(this._listElement!);
        const fragment = document.createDocumentFragment();
        const it = this._list[Symbol.iterator]();
        this._childInstances!.length = 0;
        range.forEachInIterator(it, item => {
            const child = this._childCreator(item);
            this._childInstances!.push(child);
            fragment.appendChild(mountView(child, this._mountArgs));
        });
        this._listElement!.appendChild(fragment);
        this.adjustPadding(range);
    }

    private renderUpdate(prevRange: ListRange, newRange: ListRange) {
        if (newRange.intersects(prevRange)) {
            // remove children in reverse order so child index isn't affected by previous removals
            for (const idxInList of prevRange.reverseIterable()) {
                if (!newRange.containsIndex(idxInList)) {
                    const localIdx = idxInList - prevRange.start;
                    this.removeChild(localIdx);
                }
            }
            // use forEachInIterator instead of for loop as we need to advance
            // the list iterator to the start of the range first
            newRange.forEachInIterator(this._list[Symbol.iterator](), (item, idxInList) => {
                if (!prevRange.containsIndex(idxInList)) {
                    const localIdx = idxInList - newRange.start;
                    this.addChild(localIdx, item);
                }
            });
            this.adjustPadding(newRange);
        } else {
            this.reRenderFullRange(newRange);
        }
    }

    private adjustPadding(range: ListRange) {
        const paddingTop = range.start * this.itemHeight;
        const paddingBottom = (range.totalLength - range.end) * this.itemHeight;
        const style = this._listElement!.style;
        style.paddingTop = `${paddingTop}px`;
        style.paddingBottom = `${paddingBottom}px`;
    }

    mount() {
        const listElement = super.mount();
        this.scrollContainer = tag.div({className: "LazyListParent"}, listElement) as HTMLElement;
        this.scrollContainer.addEventListener("scroll", this);
        return this.scrollContainer;
    }

    unmount() {
        this.root()!.removeEventListener("scroll", this);
        this.scrollContainer = undefined;
        super.unmount();
    }

    root(): Element | undefined {
        return this.scrollContainer;
    }

    private get _listElement(): HTMLElement | undefined {
        return super.root() as HTMLElement | undefined;
    }

    onAdd(idx: number, value: T) {
        const result = this.renderRange!.queryAdd(idx, value, this._list);
        this.applyRemoveAddResult(result);
    }

    onRemove(idx: number, value: T) {
        const result = this.renderRange!.queryRemove(idx, this._list);
        this.applyRemoveAddResult(result);
    }

    onMove(fromIdx: number, toIdx: number, value: T) {
        const result = this.renderRange!.queryMove(fromIdx, toIdx, value, this._list);
        if (result) {
            if (result.type === ResultType.Move) {
                this.moveChild(
                    this.renderRange!.toLocalIndex(result.fromIdx),
                    this.renderRange!.toLocalIndex(result.toIdx)
                );
            } else {
                this.applyRemoveAddResult(result);
            }
        }
    }

    onUpdate(i: number, value: T, params: any) {
        if (this.renderRange!.containsIndex(i)) {
            this.updateChild(this.renderRange!.toLocalIndex(i), value, params);
        }
    }

    private applyRemoveAddResult(result: AddRemoveResult<T>) {
        // order is important here, the new range can have a different start
        if (result.type === ResultType.Remove || result.type === ResultType.RemoveAndAdd) {
            this.removeChild(this.renderRange!.toLocalIndex(result.removeIdx));
        }
        if (result.newRange) {
            this.renderRange = result.newRange;
            this.adjustPadding(this.renderRange)
        }
        if (result.type === ResultType.Add || result.type === ResultType.RemoveAndAdd) {
            this.addChild(this.renderRange!.toLocalIndex(result.addIdx), result.value);
        }
    }
}
