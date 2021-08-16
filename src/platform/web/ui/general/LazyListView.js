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

import {el} from "./html.js";
import {mountView} from "./utils.js";
import {insertAt, ListView} from "./ListView.js";
import {ItemRange, ScrollDirection} from "./ItemRange.js";

export class LazyListView extends ListView {
    constructor({itemHeight, overflowMargin = 5, overflowItems = 20,...options}, childCreator) {
        super(options, childCreator);
        this._itemHeight = itemHeight;
        this._overflowMargin = overflowMargin;
        this._overflowItems = overflowItems;
    }

    _getVisibleRange() {
        const length = this._list ? this._list.length : 0;
        const scrollTop = this._parent.scrollTop;
        const topCount = Math.min(Math.max(0, Math.floor(scrollTop / this._itemHeight)), length);
        const itemsAfterTop = length - topCount;
        const visibleItems = this._height !== 0 ? Math.ceil(this._height / this._itemHeight) : 0;
        const renderCount = Math.min(visibleItems, itemsAfterTop);
        const bottomCount = itemsAfterTop - renderCount;
        return new ItemRange(topCount, renderCount, bottomCount);
    }

    _renderIfNeeded() {
        const range = this._getVisibleRange();
        const intersectRange = range.expand(this._overflowMargin);
        const renderRange = range.expand(this._overflowItems);
        // only update render Range if the new range + overflowMargin isn't contained by the old anymore 
        if (!this._renderRange.contains(intersectRange)) {
            console.log("new", renderRange);
            console.log("current", this._renderRange);
            console.log("diff", this._renderRange.diff(renderRange));
            this._renderElementsInRange(renderRange);
        }
    }

    async _initialRender() {
        /*
        Wait two frames for the return from mount() to be inserted into DOM.
        This should be enough, but if this gives us trouble we can always use
        MutationObserver.
        */
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));

        this._height = this._parent.clientHeight;
        if (this._height === 0) { console.error("LazyListView could not calculate parent height."); }
        const initialRange = this._getVisibleRange();
        const initialRenderRange = initialRange.expand(this._overflowItems);
        this._renderRange = new ItemRange(0, 0, initialRange.bottomCount + 1);
        this._renderElementsInRange(initialRenderRange);
    }

    _itemsFromList({start, end}) {
        const array = [];
        let i = 0;
        for (const item of this._list) {
            if (i >= start && i <= end) {
                array.push(item);
            }
            i = i + 1;
        }
        return array;
    }

    _itemAtIndex(idx) {
        let i = 0;
        for (const item of this._list) {
            if (i === idx) {
                return item;
            }
            i = i + 1;
        }
        return null;
    }

    _adjustPadding(range) {
        const { topCount, bottomCount } = range;
        const paddingTop = topCount * this._itemHeight;
        const paddingBottom = bottomCount * this._itemHeight;
        this._root.style.paddingTop = `${paddingTop}px`;
        this._root.style.paddingBottom = `${paddingBottom}px`;
    }

    _renderedFragment(items, childInstanceModifier) {
        const fragment = document.createDocumentFragment();
        for (const item of items) {
            const view = this._childCreator(item);
            childInstanceModifier(view);
            fragment.appendChild(mountView(view, this._mountArgs));
        }
        return fragment;
    }

    _renderElementsInRange(range) {
        const diff = this._renderRange.diff(range);
        const renderedItems = this._itemsFromList(diff.toAdd);
        this._adjustPadding(range);
        const {start, end} = diff.toRemove;
        const normalizedStart = this._renderRange.normalize(start);
        this._childInstances.splice(normalizedStart, end - start + 1).forEach(child => this._removeChild(child));

        if (diff.scrollDirection === ScrollDirection.downwards) {
            const fragment = this._renderedFragment(renderedItems, view => this._childInstances.push(view));
            this._root.appendChild(fragment);
        }
        else {
            const fragment = this._renderedFragment(renderedItems, view => this._childInstances.unshift(view));
            this._root.insertBefore(fragment, this._root.firstChild);
        }
        this._renderRange = range;
    }

    mount() {
        const root = super.mount();
        this._subscription = this._list.subscribe(this);
        this._childInstances = [];
        this._parent = el("div", {className: "LazyListParent"}, root);
        /*
        Hooking to scroll events can be expensive.
        Do we need to do more (like event throttling)?
        */
        this._parent.addEventListener("scroll", () => this._renderIfNeeded());
        this._initialRender();
        return this._parent;
    }

    update(attributes) {
        this._renderRange = null;
        super.update(attributes);
        this._childInstances = [];
        this._initialRender();
    }

    loadList() {
        // We don't render the entire list; so nothing to see here.
    }

    _removeChild(child) {
        child.root().remove();
        child.unmount();
    }

    onAdd(idx, value) {
        const {topCount, renderCount, bottomCount} = this._renderRange;
        if (this._renderRange.containsIndex(idx)) {
            this.onBeforeListChanged();
            const normalizedIdx = this._renderRange.normalize(idx);
            if (bottomCount === 0) {
                /*
                If we're at the bottom of the list, we need to render the additional item
                without removing another item from the list.
                We can't increment topCount because the index topCount is not affected by the
                add operation (and any modification will thus break ItemRange.normalize()).
                We can't increment bottomCount because there's not enough items left to trigger
                a further render.
                */
                this._renderRange = new ItemRange(topCount, renderCount + 1, bottomCount);
            }
            else {
                // Remove the last element, render the new element
                this._removeChild(this._childInstances.pop());
                this._renderRange = new ItemRange(topCount, renderCount, bottomCount + 1);
            }
            super.onAdd(normalizedIdx, value, true);
            this.onListChanged();
        }
        else {
            this._renderRange = idx < topCount ? new ItemRange(topCount + 1, renderCount, bottomCount):
                                                 new ItemRange(topCount, renderCount, bottomCount + 1);
        }
        this._adjustPadding(this._renderRange);
    }

    onRemove(idx, value) {
        const {topCount, renderCount, bottomCount} = this._renderRange;
        if (this._renderRange.containsIndex(idx)) {
            this.onBeforeListChanged();
            const normalizedIdx = this._renderRange.normalize(idx);
            super.onRemove(normalizedIdx, value, true);
            if (bottomCount === 0) {
                // See onAdd for explanation
                this._renderRange = new ItemRange(topCount, renderCount - 1, bottomCount);
            }
            else {
                const child = this._childCreator(this._itemAtIndex(this._renderRange.lastIndex));
                this._childInstances.push(child);
                this._root.appendChild(mountView(child, this._mountArgs));
                this._renderRange = new ItemRange(topCount, renderCount, bottomCount - 1);
            }
            this.onListChanged();
        }
        else {
            this._renderRange = idx < topCount ? new ItemRange(topCount - 1, renderCount, bottomCount):
                                                 new ItemRange(topCount, renderCount, bottomCount - 1);
        }
        this._adjustPadding(this._renderRange);
    }

    onUpdate(idx, value, params) {
        if (this._renderRange.containsIndex(idx)) {
            const normalizedIdx = this._renderRange.normalize(idx);
            super.onUpdate(normalizedIdx, value, params);
        }
    }
    
    recreateItem(idx, value) {
        if (this._renderRange.containsIndex(idx)) {
            const normalizedIdx = this._renderRange.normalize(idx);
            super.recreateItem(normalizedIdx, value)
        }
    }

    /**
     * Render additional element from top or bottom to offset the outgoing element
     */
    _renderExtraOnMove(fromIdx, toIdx) {
        const {topCount, renderCount} = this._renderRange;
        if (toIdx < fromIdx) {
            // Element is moved up the list, so render element from top boundary
            const index = topCount;
            const child = this._childCreator(this._itemAtIndex(index));
            this._childInstances.unshift(child);
            this._root.insertBefore(mountView(child, this._mountArgs), this._root.firstChild);
        }
        else {
            // Element is moved down the list, so render element from bottom boundary
            const index = topCount + renderCount - 1;
            const child = this._childCreator(this._itemAtIndex(index));
            this._childInstances.push(child);
            this._root.appendChild(mountView(child, this._mountArgs));
        }
    }

    /**
     * Remove an element from top or bottom to make space for the incoming element 
     */
    _removeElementOnMove(fromIdx, toIdx) {
        // If element comes from the bottom, remove element at bottom and vice versa
        const child = toIdx < fromIdx ? this._childInstances.pop() : this._childInstances.shift();
        this._removeChild(child);
    }

    onMove(fromIdx, toIdx, value) {
        const fromInRange = this._renderRange.containsIndex(fromIdx);
        const toInRange = this._renderRange.containsIndex(toIdx);
        const normalizedFromIdx = this._renderRange.normalize(fromIdx);
        const normalizedToIdx = this._renderRange.normalize(toIdx);
        if (fromInRange && toInRange) {
            super.onMove(normalizedFromIdx, normalizedToIdx, value);
        }
        else if (fromInRange && !toInRange) {
            this.onBeforeListChanged();
            const [child] = this._childInstances.splice(normalizedFromIdx, 1);
            this._removeChild(child);
            this._renderExtraOnMove(fromIdx, toIdx);
            this.onListChanged();
        }
        else if (!fromInRange && toInRange) {
            this.onBeforeListChanged();
            const child = this._childCreator(value);
            this._removeElementOnMove(fromIdx, toIdx);
            this._childInstances.splice(normalizedToIdx, 0, child);
            insertAt(this._root, normalizedToIdx, mountView(child, this._mountArgs));
            this.onListChanged();
        }
    }

}
