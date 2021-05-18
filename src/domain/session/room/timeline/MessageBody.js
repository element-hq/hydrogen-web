import { linkify } from "./linkify/linkify.js";

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
            parts.push(new LinkPart(text, text));
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

class NewLinePart {
    get type() { return "newline"; }
}

class LinkPart {
    constructor(url, text) {
        this.url = url;
        this.text = text;
    }

    get type() { return "link"; }
}

class TextPart {
    constructor(text) {
        this.text = text;
    }

    get type() { return "text"; }
}

class MessageBody {
    constructor(sourceString, parts) {
        this.sourceString = sourceString;
        this.parts = parts;
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
