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
