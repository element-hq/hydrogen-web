/*
Copyright 2025 New Vector Ltd.
Copyright 2021 Daniel Fedorin <danila.fedorin@gmail.com>
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// DOM helper functions

import {ViewNode} from "./types";

export type ClassNames<T> = { [className: string]: boolean | ((value: T) => boolean) }
export type BasicAttributes<T> = { [attribute: string]: ClassNames<T> | boolean | string }
export type Child = string | Text | ViewNode;

export function isChildren(children: object | Child | Child[]): children is Child | Child[] {
    // children should be an not-object (that's the attributes), or a domnode, or an array
    return typeof children !== "object" || "nodeType" in children || Array.isArray(children);
}

export function classNames<T>(obj: ClassNames<T>, value: T): string {
    return Object.entries(obj).reduce((cn, [name, enabled]) => {
        if (typeof enabled === "function") {
            enabled = enabled(value);
        }
        if (enabled) {
            return cn + (cn.length ? " " : "") + name;
        } else {
            return cn;
        }
    }, "");
}

export function setAttribute(el: Element, name: string, value: string | boolean): void {
    if (name === "className") {
        name = "class";
    }
    if (value === false) {
        el.removeAttribute(name);
    } else {
        if (value === true) {
            value = name;
        }
        el.setAttribute(name, value);
    }
}

export function el(elementName: string, attributes?: BasicAttributes<never> | Child | Child[], children?: Child | Child[]): Element {
    return elNS(HTML_NS, elementName, attributes, children);
}

export function elNS(ns: string, elementName: string, attributes?: BasicAttributes<never> | Child | Child[], children?: Child | Child[]): Element {
    if (attributes && isChildren(attributes)) {
        children = attributes;
        attributes = undefined;
    }

    const e = document.createElementNS(ns, elementName);

    if (attributes) {
        for (let [name, value] of Object.entries(attributes)) {
            if (typeof value === "object") {
                // Only className should ever be an object; be careful
                // here anyway and ignore object-valued non-className attributes.
                value = (value !== null && name === "className") ? classNames(value, undefined) : false;
            }
            setAttribute(e, name, value);
        }
    }

    if (children) {
        if (!Array.isArray(children)) {
            children = [children];
        }
        for (let c of children) {
            if (typeof c === "string") {
                c = text(c);
            }
            e.appendChild(c);
        }
    }
    return e;
}

export function text(str: string): Text {
    return document.createTextNode(str);
}

export const HTML_NS: string = "http://www.w3.org/1999/xhtml";
export const SVG_NS: string = "http://www.w3.org/2000/svg";

export const TAG_NAMES = {
    [HTML_NS]: [
        "br", "a", "ol", "ul", "li", "div", "h1", "h2", "h3", "h4", "h5", "h6",
        "p", "strong", "em", "span", "img", "section", "header", "main", "footer", "dialog",
        "article", "aside", "del", "blockquote", "details", "summary",
        "table", "thead", "tbody", "tr", "th", "td", "hr",
        "pre", "code", "button", "time", "input", "textarea", "select", "option", "optgroup", "label", "form",
        "progress", "output", "video", "style"],
    [SVG_NS]: ["svg", "g", "path", "circle", "ellipse", "rect", "use"]
} as const;

export const tag: { [tagName in typeof TAG_NAMES[string][number]]: (attributes?: BasicAttributes<never> | Child | Child[], children?: Child | Child[]) => Element } = {} as any;

for (const [ns, tags] of Object.entries(TAG_NAMES)) {
    for (const tagName of tags) {
        tag[tagName] = function(attributes, children) {
            return elNS(ns, tagName, attributes, children);
        }
    }
}
