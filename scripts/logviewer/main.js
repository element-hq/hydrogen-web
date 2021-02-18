import {tag as t} from "./html.js";
import {openFile, readFileAsText} from "./file.js";

const main = document.querySelector("main");

let selectedItemNode;
let rootItem;

document.querySelector("main").addEventListener("click", event => {
    if (selectedItemNode) {
        selectedItemNode.classList.remove("selected");
        selectedItemNode = null;
    }
    const itemNode = event.target.closest(".item");
    if (itemNode) {
        selectedItemNode = itemNode;
        selectedItemNode.classList.add("selected");
        const path = selectedItemNode.dataset.path;
        let item = rootItem;
        let parent;
        if (path.length) {
            const indices = path.split("/").map(i => parseInt(i, 10));
            for(const i of indices) {
                parent = item;
                item = itemChildren(item)[i];
            }
        }
        showItemDetails(item, parent);
    }
});

function showItemDetails(item, parent) {
    const aside = t.aside([
        t.h3(itemCaption(item)),
        t.ul({class: "values"}, Object.entries(itemValues(item)).map(([key, value]) => {
            return t.li([
                t.span(normalizeValueKey(key)),
                t.span(value)
            ]);
        }))
    ]);
    document.querySelector("aside").replaceWith(aside);
}

document.getElementById("openFile").addEventListener("click", loadFile);

async function loadFile() {
    const file = await openFile();
    const json = await readFileAsText(file);
    const logs = JSON.parse(json);
    rootItem = {c: logs.items};
    const fragment = logs.items.reduce((fragment, item, i, items) => {
        const prevItem = i === 0 ? null : items[i - 1];
        fragment.appendChild(t.section([
            t.h2(prevItem ? `+ ${itemStart(item) - itemEnd(prevItem)} ms` : new Date(itemStart(item)).toString()),
            t.div({className: "timeline"}, t.ol(itemToNode(item, [i])))
        ]));
        return fragment;
    }, document.createDocumentFragment());
    main.replaceChildren(fragment);
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
function itemCaption(item) {
    if (itemType(item) === "network") {
        return `${itemValues(item)?.method} ${itemValues(item)?.url}`;
    } else if (itemLabel(item) && itemValues(item)?.id) {
        return `${itemLabel(item)} ${itemValues(item).id}`;
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
function itemToNode(item, path) {
    const className = {
        item: true,
        error: itemError(item),
        [`type-${itemType(item)}`]: !!itemType(item),
        [`level-${itemLevel(item)}`]: true,
    };
    const li = t.li([
        t.div({className, "data-path": path.join("/")}, [
            t.span({class: "caption"}, itemCaption(item)),
            t.span({class: "duration"}, `(${itemDuration(item)}ms)`),
        ])
    ]);
    if (itemChildren(item) && itemChildren(item).length) {
        li.appendChild(t.ol(itemChildren(item).map((item, i) => {
            return itemToNode(item, path.concat(i));
        })));
    }
    return li;
}
