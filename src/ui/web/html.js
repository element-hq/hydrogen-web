// DOM helper functions

export function isChildren(children) {
    return typeof children !== "object" || !!children.nodeType || Array.isArray(children);
}

export function setAttribute(el, name, value) {
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

export function el(elementName, attributes, children) {
    if (attributes && isChildren(attributes)) {
        children = attributes;
        attributes = null;
    }

    const e = document.createElement(elementName);

    if (attributes) {
        for (let [name, value] of Object.entries(attributes)) {
            setAttribute(e, name, value);
        }
    }

    if (children) {
        if (!Array.isArray(children)) {
            children = [children];
        }
        for (let c of children) {
            if (!c.nodeType) {
                c = text(c);
            }
            e.appendChild(c);
        }
    }
    return e;
}

export function text(str) {
    return document.createTextNode(str);
}

export const TAG_NAMES = [
    "ol", "ul", "li", "div", "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "strong", "em", "span", "img", "section", "main", "article", "aside",
    "pre", "button"];

export const tag = {};

for (const tagName of TAG_NAMES) {
    tag[tagName] = function(attributes, children) {
        return el(tagName, attributes, children);
    }
}
