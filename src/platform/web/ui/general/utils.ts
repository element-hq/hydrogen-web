/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {IView, IMountArgs, ViewNode} from "./types";
import {tag} from "./html";

export function mountView(view: IView, mountArgs?: IMountArgs): ViewNode {
    let node;
    try {
        node = view.mount(mountArgs);
    } catch (err) {
        // Log it to the console so it's easy to reference
        console.error(err);
        // Then render our error boundary to the DOM
        node = errorToDOM(err);
    }
    return node;
}

export function errorToDOM(error: Error): Element {
    const stack = new Error().stack;
    let callee: string | null = null;
    if (stack) {
        callee = stack.split("\n")[1];
    }
    return tag.div([
        tag.h2("Something went wrong…"),
        tag.h3(error.message),
        tag.p(`This occurred while running ${callee}.`),
        tag.pre(error.stack),
    ]);
}

export function insertAt(parentNode: Element, idx: number, childNode: Node): void {
    const isLast = idx === parentNode.childElementCount;
    if (isLast) {
        parentNode.appendChild(childNode);
    } else {
        const nextDomNode = parentNode.children[idx];
        parentNode.insertBefore(childNode, nextDomNode);
    }
}

export function removeChildren(parentNode: Element): void {
    parentNode.innerHTML = '';
}

export function disableTargetCallback(callback: (evt: Event) => Promise<void>): (evt: Event) => Promise<void> {
    return async (evt: Event) => {
        (evt.target as HTMLElement)?.setAttribute("disabled", "disabled");
        await callback(evt);
        (evt.target as HTMLElement)?.removeAttribute("disabled");
    }
}
