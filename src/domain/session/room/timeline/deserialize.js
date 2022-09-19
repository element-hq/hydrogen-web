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

import { MessageBody, HeaderBlock, TableBlock, ListBlock, CodeBlock, PillPart, FormatPart, NewLinePart, RulePart, TextPart, LinkPart, ImagePart } from "./MessageBody.js"
import {linkify} from "./linkify/linkify";

/* At the time of writing (Jul 1 2021), Matrix Spec recommends
 * allowing the following HTML tags:
 *     font, del, h1, h2, h3, h4, h5, h6, blockquote, p, a, ul, ol, sup, sub, li, b, i, u,
 *     strong, em, strike, code, hr, br, div, table, thead, tbody, tr, th, td, caption, pre, span, img
 */

/**
 * Nodes that don't have any properties to them other than their tag.
 * While <a> has `href`, and <img> has `src`, these have... themselves.
 */
const basicInline = ["EM", "STRONG", "CODE", "DEL", "SPAN" ];
const basicBlock = ["DIV", "BLOCKQUOTE"];
const safeSchemas = ["https", "http", "ftp", "mailto", "magnet"].map(name => `${name}://`);
const baseUrl = 'https://matrix.to';
const linkPrefix = `${baseUrl}/#/`;

class Deserializer {
    constructor(result, mediaRepository) {
        this.result = result;
        this.mediaRepository = mediaRepository;
    }

    parsePillLink(link) {
        if (!link.startsWith(linkPrefix)) {
            return null;
        }
        const contents = link.substring(linkPrefix.length);
        if (contents[0] === '@') {
            return contents;
        }
        return null;
    }

    parseLink(node, children) {
        const href = this.result.getAttributeValue(node, "href");
        const lcUrl = href?.toLowerCase();
        // urls should be absolute and with a safe schema, as listed in the spec
        if (!lcUrl || !safeSchemas.some(schema => lcUrl.startsWith(schema))) {
            return new FormatPart("span", children);
        }
        const pillId = this.parsePillLink(href);
        if (pillId) {
            return new PillPart(pillId, href, children);
        }
        return new LinkPart(href, children);
    }

    parseList(node) {
        const result = this.result;
        let start = null;
        if (result.getNodeElementName(node) === "OL") {
            // Will return 1 for, say, '1A', which may not be intended?
            start = parseInt(result.getAttributeValue(node, "start")) || 1;
        }
        const items = [];
        for (const child of result.getChildNodes(node)) {
            if (result.getNodeElementName(child) !== "LI") {
                continue;
            }
            const item = this.parseAnyNodes(result.getChildNodes(child));
            items.push(item);
        }
        return new ListBlock(start, items);
    }

    _ensureElement(node, tag) {
        return node &&
            this.result.isElementNode(node) &&
            this.result.getNodeElementName(node) === tag;
    }

    parseCodeBlock(node) {
        const result = this.result;
        let codeNode;
        for (const child of result.getChildNodes(node)) {
            codeNode = child;
            break;
        }
        let language = null;
        if (!this._ensureElement(codeNode, "CODE")) {
            return new CodeBlock(language, this.result.getNodeText(node));
        }
        const cl = result.getAttributeValue(codeNode, "class") || ""
        for (const clname of cl.split(" ")) {
            if (clname.startsWith("language-") && !clname.startsWith("language-_")) {
                language = clname.substring(9) // "language-".length
                break;
            }
        }
        return new CodeBlock(language, this.result.getNodeText(codeNode));
    }

    parseImage(node) {
        const result = this.result;
        const src = result.getAttributeValue(node, "src") || "";
        const url = this.mediaRepository.mxcUrl(src);
        // We just ignore non-mxc `src` attributes.
        if (!url) {
            return null;
        }
        const width = parseInt(result.getAttributeValue(node, "width")) || null;
        const height = parseInt(result.getAttributeValue(node, "height")) || null;
        const alt = result.getAttributeValue(node, "alt");
        const title = result.getAttributeValue(node, "title");
        return new ImagePart(url, width, height, alt, title);
    }

    parseTableRow(row, tag) {
        const cells = [];
        for (const node of this.result.getChildNodes(row)) {
            if(!this._ensureElement(node, tag)) {
                continue;
            }
            const children = this.result.getChildNodes(node);
            const inlines = this.parseInlineNodes(children);
            cells.push(inlines);
        }
        return cells;
    }

    parseTableHead(head) {
        let headRow = null;
        for (const node of this.result.getChildNodes(head)) {
            headRow = node;
            break;
        }
        if (this._ensureElement(headRow, "TR")) {
            return this.parseTableRow(headRow, "TH");
        }
        return null;
    }

    parseTableBody(body) {
        const rows = [];
        for (const node of this.result.getChildNodes(body)) {
            if(!this._ensureElement(node, "TR")) {
                continue;
            }
            rows.push(this.parseTableRow(node, "TD"));
        }
        return rows;
    }

    parseTable(node) {
        // We are only assuming iterable, so convert to arrary for indexing.
        const children = Array.from(this.result.getChildNodes(node));
        let head, body;
        if (this._ensureElement(children[0], "THEAD") && this._ensureElement(children[1], "TBODY")) {
            head = this.parseTableHead(children[0]);
            body = this.parseTableBody(children[1]);
        } else if (this._ensureElement(children[0], "TBODY")) {
            head = null;
            body = this.parseTableBody(children[0]);
        }
        return new TableBlock(head, body);
    }

    /** Once a node is known to be an element,
     * attempt to interpret it as an inline element.
     *
     * @returns the inline message part, or null if the element
     *   is not inline or not allowed.
     */
    parseInlineElement(node) {
        const result = this.result;
        const tag = result.getNodeElementName(node);
        const children = result.getChildNodes(node);
        switch (tag) {
            case "A": {
                const inlines = this.parseInlineNodes(children);
                return this.parseLink(node, inlines);
            }
            case "BR":
                return new NewLinePart();
            default: {
                if (!basicInline.includes(tag)) {
                    return null;
                }
                const inlines = this.parseInlineNodes(children);
                return new FormatPart(tag, inlines);
            }
        }
    }

    /** Attempt to interpret a node as inline.
     *
     * @returns the inline message part, or null if the
     *   element is not inline or not allowed.
     */
    parseInlineNode(node) {
        if (this.result.isElementNode(node)) {
            return this.parseInlineElement(node);
        }
        return null;
    }

    /** Once a node is known to be an element, attempt
     * to interpret it as a block element.
     *
     * @returns the block message part, or null of the
     *   element is not a block or not allowed.
     */
    parseBlockElement(node) {
        const result = this.result;
        const tag = result.getNodeElementName(node);
        const children = result.getChildNodes(node);
        switch (tag) {
            case "H1":
            case "H2":
            case "H3":
            case "H4":
            case "H5":
            case "H6": {
                const inlines = this.parseInlineNodes(children);
                return new HeaderBlock(parseInt(tag[1]), inlines)
            }
            case "UL":
            case "OL":
                return this.parseList(node);
            case "PRE":
                return this.parseCodeBlock(node);
            case "HR":
                return new RulePart();
            case "IMG":
                return this.parseImage(node);
            case "P": {
                const inlines = this.parseInlineNodes(children);
                return new FormatPart(tag, inlines);
            }
            case "TABLE":
                return this.parseTable(node);
            default: {
                if (!basicBlock.includes(tag)) {
                    return null;
                }
                const blocks = this.parseAnyNodes(children);
                return new FormatPart(tag, blocks);
            }
        }
    }

    /** Attempt to parse a node as a block.
     *
     * @return the block message part, or null if the node
     *   is not a block element.
     */
    parseBlockNode(node) {
        if (this.result.isElementNode(node)) {
            return this.parseBlockElement(node);
        }
        return null;
    }

    _parseTextParts(node, into) {
        if(!this.result.isTextNode(node)) {
            return false;
        }

        // XXX pretty much identical to `MessageBody`'s.
        const linkifyCallback = (text, isLink) => {
            if (isLink) {
                into.push(new LinkPart(text, [new TextPart(text)]));
            } else {
                into.push(new TextPart(text));
            }
        };
        linkify(this.result.getNodeText(node), linkifyCallback);
        return true;
    }

    _isAllowedNode(node) {
        return !this._ensureElement(node, "MX-REPLY");
    }

    _parseInlineNodes(nodes, into) {
        for (const htmlNode of nodes) {
            if (this._parseTextParts(htmlNode, into)) {
                // This was a text node, and we already
                // dumped its parts into our list.
                continue;
            }
            const node = this.parseInlineNode(htmlNode);
            if (node) {
                into.push(node);
                continue;
            }
            // Node is either block or unrecognized. In
            // both cases, just move on to its children.
            if (this._isAllowedNode(htmlNode)) {
                this._parseInlineNodes(this.result.getChildNodes(htmlNode), into);
            }
        }
    }

    parseInlineNodes(nodes) {
        const into = [];
        this._parseInlineNodes(nodes, into);
        return into;
    }

    // XXX very similar to `_parseInlineNodes`.
    _parseAnyNodes(nodes, into) {
        for (const htmlNode of nodes) {
            if (this._parseTextParts(htmlNode, into)) {
                // This was a text node, and we already
                // dumped its parts into our list.
                continue;
            }
            const node = this.parseInlineNode(htmlNode) || this.parseBlockNode(htmlNode);
            if (node) {
                into.push(node);
                continue;
            }
            // Node is unrecognized. Just move on to its children.
            if (this._isAllowedNode(htmlNode)) {
                this._parseAnyNodes(this.result.getChildNodes(htmlNode), into);
            }
        }
    }

    parseAnyNodes(nodes) {
        const into = [];
        this._parseAnyNodes(nodes, into);
        return into;
    }
}

export function parseHTMLBody(platform, mediaRepository, html) {
    const parseResult = platform.parseHTML(html);
    const deserializer = new Deserializer(parseResult, mediaRepository);
    const parts = deserializer.parseAnyNodes(parseResult.rootNodes);
    return new MessageBody(html, parts);
}


export async function tests() {
    // don't import node-html-parser until it's safe to assume we're actually in a unit test,
    // as this is a devDependency
    const nodeHtmlParser = await import("node-html-parser");
    const {parse} = nodeHtmlParser.default;

    class HTMLParseResult {
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

    function test(assert, input, output) {
        assert.deepEqual(parseHTMLBody(platform, null, input), new MessageBody(input, output));
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
        "Auto-closed tags": assert => {
            const input = '<p>hello<p>world</p></p>';
            const output = [
                new FormatPart("p", [new TextPart("hello")]),
                new FormatPart("p", [new TextPart("world")])
            ];
            test(assert, input, output);
        },
        "Block elements ignored inside inline elements": assert => {
            const input = '<span><p><code>Hello</code></p></span>';
            const output = [
                new FormatPart("span", [new FormatPart("code", [new TextPart("Hello")])])
            ];
            test(assert, input, output);
        },
        "Unknown tags are ignored, but their children are kept": assert => {
            const input = '<span><dfn><code>Hello</code></dfn><footer><em>World</em></footer></span>';
            const output = [
                new FormatPart("span", [
                    new FormatPart("code", [new TextPart("Hello")]),
                    new FormatPart("em", [new TextPart("World")])
                ])
            ];
            test(assert, input, output);
        },
        "Unknown and invalid attributes are stripped": assert => {
            const input = '<em onmouseover=alert("Bad code!")>Hello</em>';
            const output = [
                new FormatPart("em", [new TextPart("Hello")])
            ];
            test(assert, input, output);
        },
        "Text with code block but no <code> tag": assert => {
            const code = 'main :: IO ()\nmain = putStrLn "Hello"'
            const input = `<pre>${code}</pre>`;
            const output = [
                new CodeBlock(null, code)
            ];
            test(assert, input, output);
        },
        "Text with code block and 'unsupported' tag": assert => {
            const code = '<em>Hello, world</em>'
            const input = `<pre>${code}</pre>`;
            const output = [
                new CodeBlock(null, code)
            ];
            test(assert, input, output);
        },
        "Reply fallback is always stripped": assert => {
            const input = 'Hello, <em><mx-reply>World</mx-reply></em>!';
            const output = [
                new TextPart('Hello, '),
                new FormatPart("em", []),
                new TextPart('!'),
            ];
            assert.deepEqual(parseHTMLBody(platform, null, input), new MessageBody(input, output));
        }
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
