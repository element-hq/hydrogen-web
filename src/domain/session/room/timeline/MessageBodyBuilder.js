import { linkify } from "./linkify/linkify.js";

export class MessageBodyBuilder {

    constructor(message = []) {
        this._root = message;
    }

    fromText(text) {
        const components = text.split("\n");
        components.flatMap(e => ["\n", e]).slice(1).forEach(e => {
            if (e === "\n") {
                this.insertNewline();
            }
            else {
                linkify(e, this.insert.bind(this));
            }
        });
    }

    insert(text, isLink) {
        if (!text.length) {
            return;
        }
        if (isLink) {
            this.insertLink(text, text);
        }
        else {
            this.insertText(text);
        }
    }

    insertText(text) {
        if (text.length) {
            this._root.push({ type: "text", text: text });
        }
    }

    insertLink(link, displayText) {
        this._root.push({ type: "link", url: link, text: displayText });
    }

    insertNewline() {
        this._root.push({ type: "newline" });
    }

    [Symbol.iterator]() {
        return this._root.values();
    }

}

export function tests() {

    function linkify(text) {
        const obj = new MessageBodyBuilder();
        obj.fromText(text);
        return obj;
    }

    function test(assert, input, output) {
        output = new MessageBodyBuilder(output);
        input = linkify(input);
        assert.deepEqual(input, output);
    }

    return {
        // Tests for text
        "Text only": assert => {
            const input = "This is a sentence";
            const output = [{ type: "text", text: input }];
            test(assert, input, output);
        },

        "Text with newline": assert => {
            const input = "This is a sentence.\nThis is another sentence.";
            const output = [
                { type: "text", text: "This is a sentence." },
                { type: "newline" },
                { type: "text", text: "This is another sentence." }
            ];
            test(assert, input, output);
        },

        "Text with newline & trailing newline": assert => {
            const input = "This is a sentence.\nThis is another sentence.\n";
            const output = [
                { type: "text", text: "This is a sentence." },
                { type: "newline" },
                { type: "text", text: "This is another sentence." },
                { type: "newline" }
            ];
            test(assert, input, output);
        }
    };
}
