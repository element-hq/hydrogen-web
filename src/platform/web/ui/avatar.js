/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {tag, text, classNames, setAttribute} from "./general/html";
/**
 * @param  {Object} vm   view model with {avatarUrl, avatarColorNumber, avatarTitle, avatarLetter}
 * @param  {Number} size
 * @return {Element}
 */
export function renderStaticAvatar(vm, size, extraClasses = undefined) {
    const hasAvatar = !!vm.avatarUrl(size);
    let avatarClasses = classNames({
        avatar: true,
        [`size-${size}`]: true,
        [`usercolor${vm.avatarColorNumber}`]: !hasAvatar
    });
    if (extraClasses) {
        avatarClasses += ` ${extraClasses}`;
    }
    const avatarContent = hasAvatar ? renderImg(vm, size) : text(vm.avatarLetter);
    const avatar = tag.div({
        className: avatarClasses,
        title: vm.avatarTitle,
        "data-testid": "avatar",
    }, [avatarContent]);
    if (hasAvatar) {
        setAttribute(avatar, "data-avatar-letter", vm.avatarLetter);
        setAttribute(avatar, "data-avatar-color", vm.avatarColorNumber);
    }
    return avatar;
}

export function renderImg(vm, size) {
    const sizeStr = size.toString();
    return tag.img({src: vm.avatarUrl(size), width: sizeStr, height: sizeStr, title: vm.avatarTitle});
}

function isAvatarEvent(e) {
    const element = e.target;
    const parent = element.parentElement;
    return element.tagName === "IMG" && parent.classList.contains("avatar");
}

export function handleAvatarError(e) {
    if (!isAvatarEvent(e)) { return; }
    const parent = e.target.parentElement;
    const avatarColorNumber = parent.getAttribute("data-avatar-color");
    parent.classList.add(`usercolor${avatarColorNumber}`);
    const avatarLetter = parent.getAttribute("data-avatar-letter");
    parent.textContent = avatarLetter;
}
