import { linkify } from "./linkify/linkify";
import { getIdentifierColorNumber, avatarInitials } from "../../../avatar";

/**
 * Parse text into parts such as newline, links and text.
 * @param {string} body A string to parse into parts
 * @returns {MessageBody} Parsed result
 */
export function parsePlainBody(body) {
    const parts = [];
    const lines = body.split("\n");

    // create callback outside of loop
    const linkifyCallback = (text, isLink) => {
        if (isLink) {
            parts.push(new LinkPart(text, [new TextPart(text)]));
        } else {
            parts.push(new TextPart(text));
        }
    };

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (line.length) {
            linkify(line, linkifyCallback);
        }
        const isLastLine = i >= (lines.length - 1);
        if (!isLastLine) {
            parts.push(new NewLinePart());
        }
    }

    return new MessageBody(body, parts);
}

export function stringAsBody(body) {
    return new MessageBody(body, [new TextPart(body)]);
}

export class HeaderBlock {
    constructor(level, inlines) {
        this.level = level;
        this.inlines = inlines;
    }

    get type() { return "header"; }
}

export class CodeBlock {
    constructor(language, text) {
        this.language = language;
        this.text = text;
    }

    get type() { return "codeblock"; }
}

export class ListBlock {
    constructor(startOffset, items) {
        this.items = items;
        this.startOffset = startOffset;
    }

    get type() { return "list"; }
}

export class TableBlock {
    constructor(head, body) {
        this.head = head;
        this.body = body;
    }

    get type() { return "table"; }
}

export class RulePart {
    get type() { return "rule"; }
}

export class NewLinePart {
    get type() { return "newline"; }
}

export class FormatPart {
    constructor(format, children) {
        this.format = format.toLowerCase();
        this.children = children;
    }

    get type() { return "format"; }
}

export class ImagePart {
    constructor(src, width, height, alt, title) {
        this.src = src;
        this.width = width;
        this.height = height;
        this.alt = alt;
        this.title = title;
    }

    get type() { return "image"; }
}

export class PillPart {
    constructor(id, href, children) {
        this.id = id;
        this.href = href;
        this.children = children;
    }

    get type() { return "pill"; }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this.id);
    }

    get avatarInitials() {
        return avatarInitials(this.id);
    }
}

export class LinkPart {
    constructor(url, inlines) {
        this.url = url;
        this.inlines = inlines;
    }

    get type() { return "link"; }
}

export class TextPart {
    constructor(text) {
        this.text = text;
    }

    get type() { return "text"; }
}

function isBlockquote(part){
    return part.type === "format" && part.format === "blockquote";
}

export class MessageBody {
    constructor(sourceString, parts) {
        this.sourceString = sourceString;
        this.parts = parts;
    }

    insertEmote(string) {
        // We want to skip quotes introduced by replies when emoting.
        // We assume that such quotes are not TextParts, because replies
        // must have a formatted body.
        let i = 0;
        for (; i < this.parts.length && isBlockquote(this.parts[i]); i++);
        this.parts.splice(i, 0, new TextPart(string));
    }
}

export function tests() {

    function test(assert, input, output) {
        assert.deepEqual(parsePlainBody(input), new MessageBody(input, output));
    }

    return {
        // Tests for text
        "Text only": assert => {
            const input = "This is a sentence";
            const output = [new TextPart(input)];
            test(assert, input, output);
        },

        "Text with newline": assert => {
            const input = "This is a sentence.\nThis is another sentence.";
            const output = [
                new TextPart("This is a sentence."),
                new NewLinePart(),
                new TextPart("This is another sentence.")
            ];
            test(assert, input, output);
        },

        "Text with newline & trailing newline": assert => {
            const input = "This is a sentence.\nThis is another sentence.\n";
            const output = [
                new TextPart("This is a sentence."),
                new NewLinePart(),
                new TextPart("This is another sentence."),
                new NewLinePart()
            ];
            test(assert, input, output);
        }
    };
}
