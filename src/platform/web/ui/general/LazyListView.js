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

class ItemRange {
    constructor(topCount, renderCount, bottomCount) {
        this.topCount = topCount;
        this.renderCount = renderCount;
        this.bottomCount = bottomCount;
    }

    contains(range) {
        // don't contain empty ranges
        // as it will prevent clearing the list
        // once it is scrolled far enough out of view
        if (!range.renderCount && this.renderCount) {
            return false;
        }
        return range.topCount >= this.topCount &&
            (range.topCount + range.renderCount) <= (this.topCount + this.renderCount);
    }

    containsIndex(idx) {
        return idx >= this.topCount && idx <= (this.topCount + this.renderCount);
    }

    expand(amount) {
        // don't expand ranges that won't render anything
        if (this.renderCount === 0) {
            return this;
        }

        const topGrow = Math.min(amount, this.topCount);
        const bottomGrow = Math.min(amount, this.bottomCount);
        return new ItemRange(
            this.topCount - topGrow,
            this.renderCount + topGrow + bottomGrow,
            this.bottomCount - bottomGrow,
        );
    }

    totalSize() {
        return this.topCount + this.renderCount + this.bottomCount;
    }

    normalize(idx) {
        /*
        map index from list to index in rendered range
        eg: if the index range of this._list is [0, 200] and we have rendered
        elements in range [50, 60] then index 50 in list must map to index 0
        in DOM tree/childInstance array.
        */
        return idx - this.topCount;
    }
}

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

    _renderIfNeeded(forceRender = false) {
        /*
        forceRender only because we don't optimize onAdd/onRemove yet.
        Ideally, onAdd/onRemove should only render whatever has changed + update padding + update renderRange
        */
        const range = this._getVisibleRange();
        const intersectRange = range.expand(this._overflowMargin);
        const renderRange = range.expand(this._overflowItems);
        // only update render Range if the new range + overflowMargin isn't contained by the old anymore 
        // or if we are force rendering
        if (forceRender || !this._renderRange.contains(intersectRange)) {
            this._renderRange = renderRange;
            this._renderElementsInRange();
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
        const range = this._getVisibleRange();
        const renderRange = range.expand(this._overflowItems);
        this._renderRange = renderRange;
        this._renderElementsInRange();
    }

    _itemsFromList(start, end) {
        const array = [];
        let i = 0;
        for (const item of this._list) {
            if (i >= start && i < end) {
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

    _renderElementsInRange() {
        const { topCount, renderCount, bottomCount } = this._renderRange;
        const paddingTop = topCount * this._itemHeight;
        const paddingBottom = bottomCount * this._itemHeight;
        const renderedItems = this._itemsFromList(topCount, topCount + renderCount);
        this._root.style.paddingTop = `${paddingTop}px`;
        this._root.style.paddingBottom = `${paddingBottom}px`;
        for (const child of this._childInstances) {
            this._removeChild(child);
        }
        this._childInstances = [];
        const fragment = document.createDocumentFragment();
        for (const item of renderedItems) {
            const view = this._childCreator(item);
            this._childInstances.push(view);
            fragment.appendChild(mountView(view, this._mountArgs));
        }
        this._root.appendChild(fragment);
    }

    mount() {
        const root = super.mount();
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
        this._initialRender();
    }

    loadList() {
        if (!this._list) { return; }
        this._subscription = this._list.subscribe(this);
        this._childInstances = [];
        /*
        super.loadList() would render the entire list at this point.
        We instead lazy render a part of the list in _renderIfNeeded
        */
    }

    _removeChild(child) {
        child.root().remove();
        child.unmount();
    }

    // If size of the list changes, re-render
    onAdd() {
        this._renderIfNeeded(true);
    }

    onRemove() {
        this._renderIfNeeded(true);
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
