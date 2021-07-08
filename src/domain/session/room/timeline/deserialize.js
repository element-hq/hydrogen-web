import { MessageBody, HeaderBlock, ListBlock, CodeBlock, FormatPart, NewLinePart, RulePart, TextPart, LinkPart, ImagePart } from "./MessageBody.js"


/* At the time of writing (Jul 1 2021), Matrix Spec recommends
 * allowing the following HTML tags:
 *     font, del, h1, h2, h3, h4, h5, h6, blockquote, p, a, ul, ol, sup, sub, li, b, i, u,
 *     strong, em, strike, code, hr, br, div, table, thead, tbody, tr, th, td, caption, pre, span, img
 */

/**
 * Nodes that don't have any properties to them other than their tag.
 * While <a> has `href`, and <img> has `src`, these have... themselves.
 */
const basicNodes = ["EM", "STRONG", "CODE", "DEL", "P", "DIV", "SPAN" ]

/**
 * Return a builder function for a particular tag.
 */
function basicWrapper(tag) {
    return (result, node, children) => new FormatPart(tag, children);
}

/**
 * Return a builder function for a particular header level.
 */
function headerWrapper(level) {
    return (result, node, children) => new HeaderBlock(level, children);
}

function parseLink(result, node, children) {
    // TODO Not equivalent to `node.href`!
    // Add another HTMLParseResult method?
    let href = result.getAttributeValue(node, "href");
    return new LinkPart(href, children);
}

function parseList(result, node) {
    let start = null;
    if (result.getNodeElementName(node) === "OL") {
        // Will return 1 for, say, '1A', which may not be intended?
        start = parseInt(result.getAttributeValue(node, "start")) || 1;
    }
    const nodes = [];
    for (const child of result.getChildNodes(node)) {
        if (result.getNodeElementName(child) !== "LI") {
            continue;
        }
        const item = parseNodes(result, result.getChildNodes(child));
        nodes.push(item);
    }
    return new ListBlock(start, nodes);
}

function parseCodeBlock(result, node) {
    let codeNode;
    for (const child of result.getChildNodes(node)) {
        codeNode = child;
        break;
    }
    if (!(codeNode && result.getNodeElementName(codeNode) === "CODE")) {
        return null;
    }
    let language = "";
    const cl = result.getAttributeValue(codeNode, "class") || ""
    for (const clname of cl.split(" ")) {
        if (clname.startsWith("language-") && !clname.startsWith("language-_")) {
            language = clname.substring(9) // "language-".length
            break;
        }
    }
    return new CodeBlock(language, codeNode.textContent);
}

// TODO: duplicated from MediaRepository. Extract somewhere.
function parseMxcUrl(url) {
    const prefix = "mxc://";
    if (url.startsWith(prefix)) {
        return url.substr(prefix.length).split("/", 2);
    } else {
        return null;
    }
}

function parseImage(result, node) {
    const src = result.getAttributeValue(node, "src") || "";
    // We just ignore non-mxc `src` attributes.
    if (!parseMxcUrl(src)) {
        return null;
    }
    const width = result.getAttributeValue(node, "width");
    const height = result.getAttributeValue(node, "height");
    const alt = result.getAttributeValue(node, "alt");
    const title = result.getAttributeValue(node, "title");
    return new ImagePart(src, { width, height, alt, title });
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

/**
 * Handlers for various nodes.
 *
 * Each handler has two properties: `descend` and `parsefn`.
 * If `descend` is true, the node's children should be
 * parsed just like any other node, and fed as a second argument
 * to `parsefn`. If not, the node's children are either to be ignored
 * (as in <pre>) or processed specially (as in <ul>).
 *
 * The `parsefn` combines a node's data and its children into
 * an internal representation node.
 */
const nodes = buildNodeMap();

function parseNode(result, node) {
    if (result.isTextNode(node)) {
        return new TextPart(result.getNodeText(node));
    } else if (result.isElementNode(node)) {
        const f = nodes[result.getNodeElementName(node)];
        if (!f) {
            return null;
        }
        const children = f.descend ? parseNodes(result, node.childNodes) : null;
        return f.parsefn(result, node, children);
    }
    return null;
}

function parseNodes(result, nodes) {
    const parsed = [];
    for (const htmlNode of nodes) {
        let node = parseNode(result, htmlNode);
        // Just ignore invalid / unknown tags.
        if (node) {
            parsed.push(node);
        }
    }
    return parsed;
}

export function parseHTMLBody({ mediaRepository, platform }, html) {
    const parseResult = platform.parseHTML(html);
    const parts = parseNodes(parseResult, parseResult.rootNodes);
    return new MessageBody(html, parts);
}

import parse from '../../../../../lib/node-html-parser/index.js';

export class HTMLParseResult {
    constructor(bodyNode) {
        this._bodyNode = bodyNode;
    }

    get rootNodes() {
        return this._bodyNode.childNodes;
    }

    getChildNodes(node) {
        return node.childNodes;
    }

    getAttributeNames(node) {
        return node.getAttributeNames();
    }

    getAttributeValue(node, attr) {
        return node.getAttribute(attr);
    }

    isTextNode(node) {
        return !node.tagName;
    }

    getNodeText(node) {
        return node.text;
    }

    isElementNode(node) {
        return !!node.tagName;
    }

    getNodeElementName(node) {
        return node.tagName;
    }
}

const platform = {
    parseHTML: (html) => new HTMLParseResult(parse(html))
};

export function tests() {
    function test(assert, input, output) {
        assert.deepEqual(parseHTMLBody({ mediaRepository: null, platform }, input), new MessageBody(input, output));
    }

    return {
        "Text only": assert => {
            const input = "This is a sentence";
            const output = [new TextPart(input)];
            test(assert, input, output);
        },
        "Text with inline code format": assert => {
            const input = "Here's <em>some</em> <code>code</code>!";
            const output = [
                new TextPart("Here's "),
                new FormatPart("em", [new TextPart("some")]),
                new TextPart(" "),
                new FormatPart("code", [new TextPart("code")]),
                new TextPart("!")
            ];
            test(assert, input, output);
        },
        "Text with ordered list with no attributes": assert => {
            const input = "<ol><li>Lorem</li><li>Ipsum</li></ol>";
            const output = [
                new ListBlock(1, [
                    [ new TextPart("Lorem") ],
                    [ new TextPart("Ipsum") ]
                ])
            ];
            test(assert, input, output);
        },
        "Text with ordered list starting at 3": assert => {
            const input = '<ol start="3"><li>Lorem</li><li>Ipsum</li></ol>';
            const output = [
                new ListBlock(3, [
                    [ new TextPart("Lorem") ],
                    [ new TextPart("Ipsum") ]
                ])
            ];
            test(assert, input, output);
        },
        "Text with unordered list": assert => {
            const input = '<ul start="3"><li>Lorem</li><li>Ipsum</li></ul>';
            const output = [
                new ListBlock(null, [
                    [ new TextPart("Lorem") ],
                    [ new TextPart("Ipsum") ]
                ])
            ];
            test(assert, input, output);
        },
        /* Doesnt work: HTML library doesn't handle <pre><code> properly.
        "Text with code block": assert => {
            const code = 'main :: IO ()\nmain = putStrLn "Hello"'
            const input = `<pre><code>${code}</code></pre>`;
            const output = [
                new CodeBlock(null, code)
            ];
            test(assert, input, output);
        }
        */
    };
}
