import { linkify } from "./linkify.js";

export class MessageBodyBuilder {

    constructor(message = []) {
        this._root = message;
    }

    fromText(text) {
        const components = text.split("\n");
        components.slice(0, -1).forEach(t => {
            linkify(t, this.insert.bind(this));
            this.insertNewline();
        });
        const [last] = components.slice(-1);
        linkify(last, this.insert.bind(this));
    }

    insert(text, isLink) {
        if (!text.length) return;
        if (isLink)
            this.insertLink(text, text);
        else
            this.insertText(text);
    }

    insertText(text) {
        if (text.length)
            this._root.push({ type: "text", text: text });
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
