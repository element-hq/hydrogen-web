export function setAttribute(el, name, value) {
    if (name === "className") {
        name = "class";
    }
    el.setAttribute(name, value);
}

export function el(elementName, attrs, children) {
    const e = document.createElement(elementName);
    if (typeof attrs === "object" && attrs !== null) {
        for (let [name, value] of Object.entries(attrs)) {
            setAttribute(e, name, value);
        }
    }
    if (children) {
        if (!Array.isArray(children)) {
            children = [children];
        }
        // TODO: use fragment here?
        for (let c of children) {
            if (typeof c === "string") {
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

export function ol(... params)      { return el("ol", ... params); }
export function ul(... params)      { return el("ul", ... params); }
export function li(... params)      { return el("li", ... params); }
export function div(... params)     { return el("div", ... params); }
export function h1(... params)      { return el("h1", ... params); }
export function h2(... params)      { return el("h2", ... params); }
export function h3(... params)      { return el("h3", ... params); }
export function h4(... params)      { return el("h4", ... params); }
export function h5(... params)      { return el("h5", ... params); }
export function h6(... params)      { return el("h6", ... params); }
export function p(... params)       { return el("p", ... params); }
export function strong(... params)  { return el("strong", ... params); }
export function em(... params)      { return el("em", ... params); }
export function span(... params)    { return el("span", ... params); }
export function img(... params)     { return el("img", ... params); }
export function section(... params) { return el("section", ... params); }
export function main(... params)    { return el("main", ... params); }
export function article(... params) { return el("article", ... params); }
export function aside(... params)   { return el("aside", ... params); }
export function pre(... params)   { return el("pre", ... params); }
