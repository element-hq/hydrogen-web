/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseUpdateView} from "./general/BaseUpdateView";
import {renderStaticAvatar, renderImg} from "./avatar";

/*
optimization to not use a sub view when changing between img and text
because there can be many many instances of this view
*/

export class AvatarView extends BaseUpdateView {
    /**
     * @param  {ViewModel} value   view model with {avatarUrl, avatarColorNumber, avatarTitle, avatarLetter}
     * @param  {Number} size
     */
    constructor(value, size) {
        super(value);
        this._root = null;
        this._avatarUrl = null;
        this._avatarTitle = null;
        this._avatarLetter = null;
        this._size = size;
    }

    _avatarUrlChanged() {
        if (this.value.avatarUrl(this._size) !== this._avatarUrl) {
            this._avatarUrl = this.value.avatarUrl(this._size);
            return true;
        }
        return false;
    }

    _avatarTitleChanged() {
        if (this.value.avatarTitle !== this._avatarTitle) {
            this._avatarTitle = this.value.avatarTitle;
            return true;
        }
        return false;
    }

    _avatarLetterChanged() {
        if (this.value.avatarLetter !== this._avatarLetter) {
            this._avatarLetter = this.value.avatarLetter;
            return true;
        }
        return false;
    }

    mount(options) {
        this._avatarUrlChanged();
        this._avatarLetterChanged();
        this._avatarTitleChanged();
        this._root = renderStaticAvatar(this.value, this._size);
        // takes care of update being called when needed
        this.subscribeOnMount(options);
        return this._root;
    }

    root() {
        return this._root;
    }

    update(vm) {
        // important to always call _...changed for every prop 
        if (this._avatarUrlChanged()) {
            // avatarColorNumber won't change, it's based on room/user id
            const bgColorClass = `usercolor${vm.avatarColorNumber}`;
            if (vm.avatarUrl(this._size)) {
                this._root.replaceChild(renderImg(vm, this._size), this._root.firstChild);
                this._root.classList.remove(bgColorClass);
            } else {
                this._root.textContent = vm.avatarLetter;
                this._root.classList.add(bgColorClass);
            }
        }
        const hasAvatar = !!vm.avatarUrl(this._size);
        if (this._avatarTitleChanged() && hasAvatar) {
            const element = this._root.firstChild;
            if (element.tagName === "IMG") {
                element.setAttribute("title", vm.avatarTitle);
            }
        }
        if (this._avatarLetterChanged() && !hasAvatar) {
            this._root.textContent = vm.avatarLetter;
        }
    }
}
