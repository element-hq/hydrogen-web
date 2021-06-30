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

import {tag, text, classNames} from "./general/html.js";
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
        [`usercolor${vm.avatarColorNumber}`]: true
    });
    if (extraClasses) {
        avatarClasses += ` ${extraClasses}`;
    }
    const avatarContent = hasAvatar ? renderImg(vm, size) : text(vm.avatarLetter);
    return tag.div({className: avatarClasses, 'data-avatar-letter': vm.avatarLetter}, [avatarContent]);
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
    const avatarLetter = parent.getAttribute("data-avatar-letter");
    parent.textContent = avatarLetter;
}
