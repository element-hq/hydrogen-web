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

import {tag as t} from "./html.js";
import {openFile, readFileAsText} from "./file.js";

const main = document.querySelector("main");

let selectedItemNode;
let rootItem;
let itemByRef;

const logLevels = [undefined, "All", "Debug", "Detail", "Info", "Warn", "Error", "Fatal", "Off"];

main.addEventListener("click", event => {
    if (event.target.classList.contains("toggleExpanded")) {
        const li = event.target.parentElement.parentElement;
        li.classList.toggle("expanded");
    } else {
        // allow clicking any links other than .item in the timeline, like refs
        if (event.target.tagName === "A" && !event.target.classList.contains("item")) {
            return;
        }
        const itemNode = event.target.closest(".item");
        if (itemNode) {
            // we don't want scroll to jump when clicking
            // so prevent default behaviour, and select and push to history manually
            event.preventDefault();
            selectNode(itemNode);
            history.pushState(null, null, `#${itemNode.id}`);
        }
    }
});

window.addEventListener("hashchange", () => {
    const id = window.location.hash.substr(1);
    const itemNode = document.getElementById(id);
    if (itemNode && itemNode.closest("main")) {
        selectNode(itemNode);
        itemNode.scrollIntoView({behavior: "smooth", block: "nearest"});
    }
});

function selectNode(itemNode) {
    if (selectedItemNode) {
        selectedItemNode.classList.remove("selected");
    }
    selectedItemNode = itemNode;
    selectedItemNode.classList.add("selected");
    let item = rootItem;
    let parent;
    const indices = selectedItemNode.id.split("/").map(i => parseInt(i, 10));
    for(const i of indices) {
        parent = item;
        item = itemChildren(item)[i];
    }
    showItemDetails(item, parent, selectedItemNode);
}

function stringifyItemValue(value) {
    if (typeof value === "object" && value !== null) {
        return JSON.stringify(value, undefined, 2);
    } else {
        return value + "";
    }
}

function showItemDetails(item, parent, itemNode) {
    const parentOffset = itemStart(parent) ? `${itemStart(item) - itemStart(parent)}ms` : "none";
    const expandButton = t.button("Expand recursively");
    expandButton.addEventListener("click", () => expandResursively(itemNode.parentElement.parentElement));
    const aside = t.aside([
        t.h3(itemCaption(item)),
        t.p([t.strong("Log level: "), logLevels[itemLevel(item)]]),
        t.p([t.strong("Error: "), itemError(item) ? `${itemError(item).name} ${itemError(item).stack}` : "none"]),
        t.p([t.strong("Parent offset: "), parentOffset]),
        t.p([t.strong("Start: "), new Date(itemStart(item)).toString()]),
        t.p([t.strong("Duration: "), `${itemDuration(item)}ms`]),
        t.p([t.strong("Child count: "), itemChildren(item) ? `${itemChildren(item).length}` : "none"]),
        t.p([t.strong("Forced finish: "), (itemForcedFinish(item) || false) + ""]),
        t.p(t.strong("Values:")),
        t.ul({class: "values"}, Object.entries(itemValues(item)).map(([key, value]) => {
            let valueNode;
            if (key === "ref") {
                const refItem = itemByRef.get(value);
                if (refItem) {
                    valueNode = t.a({href: `#${refItem.id}`}, itemCaption(refItem));
                } else {
                    valueNode = `unknown ref ${value}`;
                }
            } else {
                valueNode = stringifyItemValue(value);
            }
            return t.li([
                t.span({className: "key"}, normalizeValueKey(key)),
                t.span({className: "value"}, valueNode)
            ]);
        })),
        t.p(expandButton)
    ]);
    document.querySelector("aside").replaceWith(aside);
}

function expandResursively(li) {
    li.classList.add("expanded");
    const ol = li.querySelector("ol");
    if (ol) {
        const len = ol.children.length;
        for (let i = 0; i < len; i += 1) {
            expandResursively(ol.children[i]);
        }
    }
}

document.getElementById("openFile").addEventListener("click", loadFile);

function getRootItemHeader(prevItem, item) {
    if (prevItem) {
        const diff = itemStart(item) - itemEnd(prevItem);
        if (diff >= 0) {
            return `+ ${formatTime(diff)}`;
        } else {
            return `ran ${formatTime(-diff)} in parallel with`;
        }
    } else {
        return new Date(itemStart(item)).toString();
    }
}

async function loadFile() {
    const file = await openFile();
    const json = await readFileAsText(file);
    const logs = JSON.parse(json);
    logs.items.sort((a, b) => itemStart(a) - itemStart(b));
    rootItem = {c: logs.items};
    itemByRef = new Map();
    preprocessRecursively(rootItem, null, itemByRef, []);

    const fragment = logs.items.reduce((fragment, item, i, items) => {
        const prevItem = i === 0 ? null : items[i - 1];
        fragment.appendChild(t.section([
            t.h2(getRootItemHeader(prevItem, item)),
            t.div({className: "timeline"}, t.ol(itemToNode(item, [i])))
        ]));
        return fragment;
    }, document.createDocumentFragment());
    main.replaceChildren(fragment);
}

function preprocessRecursively(item, parentElement, refsMap, path) {
    item.s = (parentElement?.s || 0) + item.s;
    if (itemRefSource(item)) {
        refsMap.set(itemRefSource(item), item);
    }
    if (itemChildren(item)) {
        for (let i = 0; i < itemChildren(item).length; i += 1) {
            // do it in advance for a child as we don't want to do it for the rootItem
            const child = itemChildren(item)[i];
            const childPath = path.concat(i);
            child.id = childPath.join("/");
            preprocessRecursively(child, item, refsMap, childPath);
        }
    }
}

function formatTime(ms) {
    if (ms < 1000) {
        return `${ms}ms`;
    } else if (ms < 1000 * 60) {
        return `${(ms / 1000).toFixed(2)}s`;
    } else if (ms < 1000 * 60 * 60) {
        return `${(ms / (1000 * 60)).toFixed(2)}m`;
    } else if (ms < 1000 * 60 * 60 * 24) {
        return `${(ms / (1000 * 60 * 60)).toFixed(2)}h`;
    } else  {
        return `${(ms / (1000 * 60 * 60 * 24)).toFixed(2)}d`;
    }
}

function itemChildren(item) { return item.c; }
function itemStart(item) { return item.s; }
function itemEnd(item) { return item.s + item.d; }
function itemDuration(item) { return item.d; }
function itemValues(item) { return item.v; }
function itemLevel(item) { return item.l; }
function itemLabel(item) { return item.v?.l; }
function itemType(item) { return item.v?.t; }
function itemError(item) { return item.e; }
function itemForcedFinish(item) { return item.f; }
function itemRef(item) { return item.v?.ref; }
function itemRefSource(item) { return item.v?.refId; }
function itemShortErrorMessage(item) {
    if (itemError(item)) {
        const e = itemError(item);
        return e.name || e.stack.substr(0, e.stack.indexOf("\n")); 
    }
}

function itemCaption(item) {
    if (itemType(item) === "network") {
        return `${itemValues(item)?.method} ${itemValues(item)?.url}`;
    } else if (itemLabel(item) && itemValues(item)?.id) {
        return `${itemLabel(item)} ${itemValues(item).id}`;
    } else if (itemLabel(item) && itemValues(item)?.status) {
        return `${itemLabel(item)} (${itemValues(item).status})`;
    } else if (itemLabel(item) && itemError(item)) {
        return `${itemLabel(item)} (${itemShortErrorMessage(item)})`;
    } else if (itemRef(item)) {
        const refItem = itemByRef.get(itemRef(item));
        if (refItem) {
            return `ref "${itemCaption(refItem)}"`
        } else {
            return `unknown ref ${itemRef(item)}`
        }
    } else {
        return itemLabel(item) || itemType(item);
    }
}
function normalizeValueKey(key) {
    switch (key) {
        case "t": return "type";
        case "l": return "label";
        default: return key;
    }
} 

// returns the node and the total range (recursively) occupied by the node
function itemToNode(item) {
    const hasChildren = !!itemChildren(item)?.length;
    const className = {
        item: true,
        "has-children": hasChildren,
        error: itemError(item),
        [`type-${itemType(item)}`]: !!itemType(item),
        [`level-${itemLevel(item)}`]: true,
    };

    const id = item.id;
    let captionNode;
    if (itemRef(item)) {
        const refItem = itemByRef.get(itemRef(item));
        if (refItem) {
            captionNode = ["ref ", t.a({href: `#${refItem.id}`}, itemCaption(refItem))];
        }
    }
    if (!captionNode) {
        captionNode = itemCaption(item);
    }
    const li = t.li([
        t.div([
            hasChildren ? t.button({className: "toggleExpanded"}) : "",
            t.a({className, id, href: `#${id}`}, [
                t.span({class: "caption"}, captionNode),
                t.span({class: "duration"}, `(${itemDuration(item)}ms)`),
            ])
        ])
    ]);
    if (itemChildren(item) && itemChildren(item).length) {
        li.appendChild(t.ol(itemChildren(item).map(item => {
            return itemToNode(item);
        })));
    }
    return li;
}
