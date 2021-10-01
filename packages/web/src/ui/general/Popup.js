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

import {tag} from "./html";

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

    _getPopupContainer() {
        const appContainer = this._target.closest(".hydrogen");
        let popupContainer = appContainer.querySelector(".popupContainer");
        if (!popupContainer) {
            popupContainer = tag.div({className: "popupContainer"});
            appContainer.appendChild(popupContainer);
        }
        return popupContainer;
    }

    trackInTemplateView(templateView) {
        this._trackingTemplateView = templateView;
        this._trackingTemplateView.addSubView(this);
    }

    showRelativeTo(target, verticalPadding = 0) {
        this._target = target;
        this._verticalPadding = verticalPadding;
        this._scroller = findScrollParent(this._target);
        this._view.mount();
        this._getPopupContainer().appendChild(this._popup);
        this._position();
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
            if(!this._position()) {
                this.close();
            }
        } else if (evt.type === "click") {
            this._onClick(evt);
        }
    }

    _onClick() {
        this.close();
    }

    _position() {
        const targetPosition = this._target.getBoundingClientRect();
        const popupWidth = this._popup.clientWidth;
        const popupHeight = this._popup.clientHeight;
        const viewport = (this._scroller ? this._scroller : document.documentElement).getBoundingClientRect();

        if (
            targetPosition.top > viewport.bottom ||
            targetPosition.left > viewport.right ||
            targetPosition.bottom < viewport.top ||
            targetPosition.right < viewport.left
        ) {
            return false;
        }
        if (viewport.bottom >= targetPosition.bottom + popupHeight) {
            // show below
            this._popup.style.top = `${targetPosition.bottom + this._verticalPadding}px`;
        } else if (viewport.top <= targetPosition.top - popupHeight) {
            // show top
            this._popup.style.top = `${targetPosition.top - popupHeight - this._verticalPadding}px`;
        } else {
            return false;
        }
        if (viewport.right >= targetPosition.right + popupWidth) {
            // show right
            this._popup.style.left = `${targetPosition.left}px`;
        } else if (viewport.left <= targetPosition.left - popupWidth) {
            // show left
            this._popup.style.left = `${targetPosition.right - popupWidth}px`;
        } else {
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
            const overflowY = style.getPropertyValue("overflow-y");
            if (overflowY === "auto" || overflowY === "scroll") {
                return parent;
            }
        }
    } while (parent !== document.body);
}
