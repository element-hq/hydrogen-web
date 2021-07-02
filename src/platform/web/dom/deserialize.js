import { HeaderBlock, ListBlock, CodeBlock, FormatPart, NewLinePart, RulePart, TextPart, LinkPart } from "../../../domain/session/room/timeline/MessageBody.js"


/* At the time of writing (Jul 1 2021), Matrix Spec recommends
 * allowing the following HTML tags:
 *     font, del, h1, h2, h3, h4, h5, h6, blockquote, p, a, ul, ol, sup, sub, li, b, i, u,
 *     strong, em, strike, code, hr, br, div, table, thead, tbody, tr, th, td, caption, pre, span, img
 */

const basicNodes = ["EM", "STRONG", "CODE", "DEL", "P", "DIV", "SPAN" ]

function basicWrapper(tag) {
    return (_, children) => new FormatPart(tag, children);
}

function headerWrapper(level) {
    return (_, children) => new HeaderBlock(level, children);
}

function parseLink(node, children) {
    return new LinkPart(node.href, children);
}

function parseList(node) {
    const start = node.getAttribute("start") || 1;
    const nodes = [];
    const len = node.childNodes.length;
    for (let i = 0; i < len; i += 1) {
        const child = node.childNodes[i];
        if (child.tagName !== "LI") {
            continue;
        }
        nodes.push(parseNodes(child.childNodes));
    }
    return new ListBlock(start, nodes);
}

function parseCodeBlock(node) {
    let codeNode;
    if (!((codeNode = node.firstChild) && codeNode.nodeName == "CODE")) {
        return null;
    }
    let language = "";
    for (const clname of codeNode.classList) {
        if (clname.startsWith("language-") && !clname.startsWith("language-_")) {
            language = clname.substring(9) // "language-".length
            break;
        }
    }
    return new CodeBlock(language, codeNode.textContent);
}

function parseImage(node) {
    return null;
}

function buildNodeMap() {
    let map = {
        A: { descend: true, parsefn: parseLink },
        UL: { descend: false, parsefn: parseList },
        OL: { descend: false, parsefn: parseList },
        PRE: { descend: false, parsefn: parseCodeBlock },
        BR: { descend: false, parsefn: () => new NewLinePart() },
        HR: { descend: false, parsefn: () => new RulePart() },
        IMG: { descend: false, parsefn: parseImage }
    }
    for (const tag of basicNodes) {
        map[tag] = { descend: true, parsefn: basicWrapper(tag) }
    }
    for (let level = 1; level <= 6; level++) {
        const tag = "h" + level;
        map[tag] = { descend: true, parsefn: headerWrapper(level) }
    }
    return map;
}

const nodes = buildNodeMap();

function parseNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return new TextPart(node.nodeValue);
    } else if (node.nodeType == Node.ELEMENT_NODE) {
        const f = nodes[node.nodeName];
        if (!f) {
            return null;
        }
        let result = f.parsefn(node, f.descend ? parseNodes(node.childNodes) : null);
        return result;
    }
    return null;
}

function parseNodes(nodes) {
    const len = nodes.length;
    const parsed = [];
    for (let i = 0; i < len; i ++) {
        let node = parseNode(nodes[i]);
        if (node) {
            parsed.push(node);
        }
    }
    return parsed;
}

export function parse(html) {
    const rootNode = new DOMParser().parseFromString(html, "text/html").body;
    return parseNodes(rootNode.childNodes);
}
