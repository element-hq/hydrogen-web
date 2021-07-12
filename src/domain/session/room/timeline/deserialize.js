import { MessageBody, HeaderBlock, ListBlock, CodeBlock, FormatPart, NewLinePart, RulePart, TextPart, LinkPart, ImagePart } from "./MessageBody.js"
import sanitizeHtml from "../../../../../lib/sanitize-html/index.js"

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

class Deserializer {
    constructor(result, mediaRepository) {
        this.result = result;
        this.mediaRepository = mediaRepository;
    }

    parseLink(node, children) {
        // TODO Not equivalent to `node.href`!
        // Add another HTMLParseResult method?
        let href = this.result.getAttributeValue(node, "href");
        return new LinkPart(href, children);
    }

    parseList(node) {
        const result = this.result;
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
            const item = this.parseNodes(result.getChildNodes(child));
            nodes.push(item);
        }
        return new ListBlock(start, nodes);
    }

    parseCodeBlock(node) {
        const result = this.result;
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

    parseImage(node) {
        const result = this.result;
        const src = result.getAttributeValue(node, "src") || "";
        const url = this.mediaRepository.mxcUrl(src);
        // We just ignore non-mxc `src` attributes.
        if (!url) {
            return null;
        }
        const width = result.getAttributeValue(node, "width");
        const height = result.getAttributeValue(node, "height");
        const alt = result.getAttributeValue(node, "alt");
        const title = result.getAttributeValue(node, "title");
        return new ImagePart(url, { width, height, alt, title });
    }

    parseElement(node) {
        const result = this.result;
        const tag = result.getNodeElementName(node);
        switch (tag) {
            case "H1":
            case "H2":
            case "H3":
            case "H4":
            case "H5":
            case "H6": {
                const children = this.parseChildNodes(node);
                return new HeaderBlock(parseInt(tag[1]), children)
            }
            case "A": {
                const children = this.parseChildNodes(node);
                return this.parseLink(node, children);
            }
            case "UL":
            case "OL":
                return this.parseList(node);
            case "PRE":
                return this.parseCodeBlock(node);
            case "BR":
                return new NewLinePart();
            case "HR":
                return new RulePart();
            case "IMG":
                return this.parseImage(node);
            default: {
                if (!basicNodes.includes(tag)) {
                    return null;
                }
                const children = this.parseChildNodes(node);
                return new FormatPart(tag, children);
            }
        }
    }

    parseNode(node) {
        const result = this.result;
        if (result.isTextNode(node)) {
            return new TextPart(result.getNodeText(node));
        } else if (result.isElementNode(node)) {
            return this.parseElement(node);
        }
        return null;
    }

    parseChildNodes(node) {
        const childNodes = this.result.getChildNodes(node);
        return this.parseNodes(childNodes);
    }

    parseNodes(nodes) {
        const parsed = [];
        for (const htmlNode of nodes) {
            let node = this.parseNode(htmlNode);
            // Just ignore invalid / unknown tags.
            if (node) {
                parsed.push(node);
            }
        }
        return parsed;
    }
}

const sanitizeConfig = {
    allowedTags: [
        "font", "del", "h1", "h2", "h3", "h4", "h5", "h6",
        "blockquote", "p", "a", "ul", "ol", "sup", "sub", "li",
        "b", "i", "u", "strong", "em", "strike", "code", "hr",
        "br", "div", "table", "thead", "tbody", "tr", "th", "td",
        "caption", "pre", "span", "img"
    ],
    allowedAttributes: {
        "font": ["data-mx-bg-color", "data-mx-color"],
        "span": ["data-mx-bg-color", "data-mx-color"],
        "a": ["name", "target", "href"],
        "img": ["width", "height", "alt", "title", "src"],
        "ol": ["start"],
        "code": ["class"]
    },
    allowedSchemes: [ "http", "https", "ftp", "mailto", "tel", "mxc" ]
};

export function parseHTMLBody(platform, mediaRepository, html) {
    const parseResult = platform.parseHTML(sanitizeHtml(html, sanitizeConfig));
    const deserializer = new Deserializer(parseResult, mediaRepository);
    const parts = deserializer.parseNodes(parseResult.rootNodes);
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
