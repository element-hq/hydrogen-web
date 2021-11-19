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

import {tag} from "./html";
import {removeChildren, mountView} from "./utils";
import {ItemRange} from "./ItemRange";
import {ListView, IOptions as IParentOptions} from "./ListView";
import {IView} from "./types";

export interface IOptions<T, V> extends IParentOptions<T, V> {
    itemHeight: number;
    overflowMargin?: number;
    overflowItems?: number;
}

export class LazyListView<T, V extends IView> extends ListView<T, V> {
    private renderRange?: ItemRange;
    private height?: number;
    private itemHeight: number;
    private overflowItems: number;
    private scrollContainer?: Element;

    constructor(
        {itemHeight, overflowMargin = 5, overflowItems = 20,...options}: IOptions<T, V>, 
        childCreator: (value: T) => V
    ) {
        super(options, childCreator);
        this.itemHeight = itemHeight;
        this.overflowItems = overflowItems;
        // TODO: this.overflowMargin = overflowMargin;
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
    
    override async loadList() {
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
        const visibleRange = this._getVisibleRange();
        this.renderRange = visibleRange.expand(this.overflowItems);
        this._childInstances = [];
        this._subscription = this._list.subscribe(this);
        this.reRenderFullRange(this.renderRange);
    }

    private _getVisibleRange() {
        const {clientHeight, scrollTop} = this.root()!;
        if (clientHeight === 0) {
            throw new Error("LazyListView height is 0");
        }
        return ItemRange.fromViewport(this._list.length, this.itemHeight, clientHeight, scrollTop);
    }

    private reRenderFullRange(range: ItemRange) {
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

    private renderUpdate(prevRange: ItemRange, newRange: ItemRange) {
        if (newRange.intersects(prevRange)) {
            for (const idxInList of prevRange) {
                // TODO: we need to make sure we keep childInstances in order so the indices lign up.
                // Perhaps we should join both ranges and see in which range it appears and either add or remove?
                if (!newRange.containsIndex(idxInList)) {
                    const localIdx = idxInList - prevRange.start;
                    this.removeChild(localIdx);
                }
            }
            const addedRange = newRange.missingFrom(prevRange);
            addedRange.forEachInIterator(this._list[Symbol.iterator](), (item, idxInList) => {
                const localIdx = idxInList - newRange.start;
                this.addChild(localIdx, item);
            });
            this.adjustPadding(newRange);
        } else {
            this.reRenderFullRange(newRange);
        }
    }

    private adjustPadding(range: ItemRange) {
        const paddingTop = range.start * this.itemHeight;
        const paddingBottom = (range.totalLength - range.end) * this.itemHeight;
        const style = this.scrollContainer!.style;
        style.paddingTop = `${paddingTop}px`;
        style.paddingBottom = `${paddingBottom}px`;
    }

    mount() {
        const listElement = super.mount();
        this.scrollContainer = tag.div({className: "LazyListParent"}, listElement);
        /*
        Hooking to scroll events can be expensive.
        Do we need to do more (like event throttling)?
        */
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

    private get _listElement(): Element | undefined {
        return super.root();
    }

    onAdd(idx: number, value: T) {
        // TODO: update totalLength in renderRange
        const result = this.renderRange!.queryAdd(idx);
        if (result.addIdx !== -1) {
            this.addChild(result.addIdx, value);
        }
        if (result.removeIdx !== -1) {
            this.removeChild(result.removeIdx);
        }
    }

    onRemove(idx: number, value: T) {
        // TODO: update totalLength in renderRange
        const result = this.renderRange!.queryRemove(idx);
        if (result.removeIdx !== -1) {
            this.removeChild(result.removeIdx);
        }
        if (result.addIdx !== -1) {
            this.addChild(result.addIdx, value);
        }
    }

    onMove(fromIdx: number, toIdx: number, value: T) {
        const result = this.renderRange!.queryMove(fromIdx, toIdx);
        if (result.moveFromIdx !== -1 && result.moveToIdx !== -1) {
            this.moveChild(result.moveFromIdx, result.moveToIdx);
        } else if (result.removeIdx !== -1) {
            this.removeChild(result.removeIdx);
        } else if (result.addIdx !== -1) {
            this.addChild(result.addIdx, value);
        }
    }

    onUpdate(i: number, value: T, params: any) {
        const updateIdx = this.renderRange!.queryUpdate(i);
        if (updateIdx !== -1) {
            this.updateChild(updateIdx, value, params);
        }
    }
}
