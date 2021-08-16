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

import {createEnum} from "../../../../utils/enum.js";

export const ScrollDirection = createEnum("upwards", "downwards");

export class ItemRange {
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
        return idx >= this.topCount && idx <= this.lastIndex;
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

    get lastIndex() {
        return this.topCount + this.renderCount - 1;
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

    scrollDirectionTo(range) {
        return range.bottomCount < this.bottomCount ? ScrollDirection.downwards : ScrollDirection.upwards;
    }

    /**
     * Check if this range intersects with another range 
     * @param {ItemRange} range The range to check against
     * @param {ScrollDirection} scrollDirection
     * @returns {boolean}
     */
    intersects(range) {
        return !!Math.max(0, Math.min(this.lastIndex, range.lastIndex) - Math.max(this.topCount, range.topCount));
    }

    diff(range) {
        /**
         *      Range-1
         * |----------------------|
         *              Range-2
         *          |---------------------|
         * <-------><------------><------->
         * bisect-1  intersection  bisect-2
         */
        const scrollDirection = this.scrollDirectionTo(range);
        if (!this.intersects(range)) {
            // There is no intersection between the ranges; which can happen if you scroll really fast
            // In this case, we need to do full render of the new range
            const toRemove = { start: this.topCount, end: this.lastIndex };
            const toAdd = { start: range.topCount, end: range.lastIndex };
            return {toRemove, toAdd, scrollDirection};
        }
        const bisection1 = {start: Math.min(this.topCount, range.topCount), end: Math.max(this.topCount, range.topCount) - 1};
        const bisection2 = {start: Math.min(this.lastIndex, range.lastIndex) + 1, end: Math.max(this.lastIndex, range.lastIndex)};
        // When scrolling down, bisection1 needs to be removed and bisection2 needs to be added
        // When scrolling up, vice versa
        const toRemove = scrollDirection === ScrollDirection.downwards ? bisection1 : bisection2;
        const toAdd = scrollDirection === ScrollDirection.downwards ? bisection2 : bisection1;
        return {toAdd, toRemove, scrollDirection};
    }
}
