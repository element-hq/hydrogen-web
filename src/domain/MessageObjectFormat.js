export class MessageObjectFormat {

    constructor(message = []) {
        this._root = message;
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
