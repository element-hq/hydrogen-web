/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

const HorizontalAxis = {
    scrollOffset(el) {return el.scrollLeft;},
    size(el) {return el.offsetWidth;},
    offsetStart(el) {return el.offsetLeft;},
    setStart(el, value) {el.style.left = `${value}px`;}, 
    setEnd(el, value) {el.style.right = `${value}px`;},
};
const VerticalAxis = {
    scrollOffset(el) {return el.scrollTop;},
    size(el) {return el.offsetHeight;},
    offsetStart(el) {return el.offsetTop;},
    setStart(el, value) {el.style.top = `${value}px`;}, 
    setEnd(el, value) {el.style.bottom = `${value}px`;},
};

export class Popup {
    constructor(view, closeCallback = null) {
        this._view = view;
        this._target = null;
        this._arrangement = null;
        this._scroller = null;
        this._fakeRoot = null;
        this._trackingTemplateView = null;
        this._closeCallback = closeCallback;
    }

    trackInTemplateView(templateView) {
        this._trackingTemplateView = templateView;
        this._trackingTemplateView.addSubView(this);
    }

    /**
    @param {DOMElement}
    @param {string} arrangement.relativeTo: whether top/left or bottom/right is used to position
    @param {string} arrangement.align: how much of the popup axis size (start: 0, end: width or center: width/2)
           is taken into account when positioning relative to the target
    @param {number} arrangement.before extra padding to shift the final positioning with
    @param {number} arrangement.after extra padding to shift the final positioning with
    */
    showRelativeTo(target, arrangement) {
        this._target = target;
        this._arrangement = arrangement;
        this._scroller = findScrollParent(this._target);
        this._view.mount();
        this._target.offsetParent.appendChild(this._popup);
        this._applyArrangementAxis(HorizontalAxis, this._arrangement.horizontal);
        this._applyArrangementAxis(VerticalAxis, this._arrangement.vertical);
        if (this._scroller) {
            document.body.addEventListener("scroll", this, true);
        }
        setTimeout(() => {
            document.body.addEventListener("click", this, false);
        }, 10);
    }

    get isOpen() {
        return !!this._view;
    }

    close() {
        if (this._view) {
            this._view.unmount();
            this._trackingTemplateView.removeSubView(this);
            if (this._scroller) {
                document.body.removeEventListener("scroll", this, true);
            }
            document.body.removeEventListener("click", this, false);
            this._popup.remove();
            this._view = null;
            if (this._closeCallback) {
                this._closeCallback();
            }
        }
    }

    get _popup() {
        return this._view.root();
    }

    handleEvent(evt) {
        if (evt.type === "scroll") {
            this._onScroll();
        } else if (evt.type === "click") {
            this._onClick(evt);
        }
    }

    _onScroll() {
        if (this._scroller && !this._isVisibleInScrollParent(VerticalAxis)) {
            this.close();
        } else {
            this._applyArrangementAxis(HorizontalAxis, this._arrangement.horizontal);
            this._applyArrangementAxis(VerticalAxis, this._arrangement.vertical);
        }
    }

    _onClick() {
        this.close();
    }

    _applyArrangementAxis(axis, {relativeTo, align, before, after}) {
        // TODO: using {relativeTo: "end", align: "start"} to align the right edge of the popup
        // with the right side of the target doens't make sense here, we'd expect align: "right"?
        // see RoomView
        if (relativeTo === "end") {
            let end = axis.size(this._target.offsetParent) - axis.offsetStart(this._target);
            if (align === "end") {
                end -= axis.size(this._popup);
            } else if (align === "center") {
                end -= ((axis.size(this._popup) / 2) - (axis.size(this._target) / 2));
            }
            if (typeof before === "number") {
                end += before;
            } else if (typeof after === "number") {
                end -= (axis.size(this._target) + after);
            }
            axis.setEnd(this._popup, end);
        } else if (relativeTo === "start") {
            let scrollOffset = this._scroller ? axis.scrollOffset(this._scroller) : 0;
            let start = axis.offsetStart(this._target) - scrollOffset;
            if (align === "start") {
                start -= axis.size(this._popup);
            } else if (align === "center") {
                start -= ((axis.size(this._popup) / 2) - (axis.size(this._target) / 2));
            }
            if (typeof before === "number") {
                start -= before;
            } else if (typeof after === "number") {
                start += (axis.size(this._target) + after);
            }
            axis.setStart(this._popup, start);
        } else {
            throw new Error("unknown relativeTo: " + relativeTo);
        }
    }

    _isVisibleInScrollParent(axis) {
        // clipped at start?
        if ((axis.offsetStart(this._target) + axis.size(this._target)) < (
            axis.offsetStart(this._scroller) + 
            axis.scrollOffset(this._scroller)
        )) {
            return false;
        }
        // clipped at end?
        if (axis.offsetStart(this._target) > (
            axis.offsetStart(this._scroller) + 
            axis.size(this._scroller) + 
            axis.scrollOffset(this._scroller)
        )) {
            return false;
        }
        return true;
    }

    /* fake IView api, so it can be tracked by a template view as a subview */
    root() {
        return this._fakeRoot;
    }

    mount() {
        this._fakeRoot = document.createComment("popup");
        return this._fakeRoot;
    }

    unmount() {
        this.close();
    }

    update() {}
}

function findScrollParent(el) {
    let parent = el;
    do {
        parent = parent.parentElement;
        if (parent.scrollHeight > parent.clientHeight) {
            // double check that overflow would allow a scrollbar
            // because some elements, like a button with negative margin to increate the click target
            // can cause the scrollHeight to be larger than the clientHeight in the parent
            // see button.link class
            const style = window.getComputedStyle(parent);
            const {overflow} = style;
            if (overflow === "auto" || overflow === "scroll") {
                return parent;
            }
        }
    } while (parent !== el.offsetParent);
}
