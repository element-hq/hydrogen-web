import { MessageObjectFormat } from "./MessageObjectFormat.js";

export class Linkifier {

    /**
     * @param {String} text Text to linkify
     */
    constructor(text) {
        this._text = text;
        this._curr = 0;
        this._message = new MessageObjectFormat();
    }

    /**
     * Separate string into text, newlines and add them into message object.
     * @param {String} text 
     */
    _addTextToMessage(text) {
        const components = text.split("\n");
        components.slice(0, -1).forEach(t => {
            this._message.insertText(t);
            this._message.insertNewline();
        });
        const [last] = components.slice(-1);
        this._message.insertText(last);
    }

    /**
     * Add text from this._curr upto start of supplied match into message object.
     * If match is not provided, everything from this._curr to the end of 
     * this._text is added as text to the message object.
     * @param {Array} [match] regex match 
     */
    _handleText(match) {
        const index = match?.index;
        const text = this._text.slice(this._curr, index);
        this._addTextToMessage(text);
        const len = match?.[0].length;
        this._curr = index + len;
    }

    /**
     * Splits message text into parts (text, newline and links)
     * @returns {MessageObjectFormat} Object representation of chat message
     */
    linkify() {
        const regex = /(?:https|http|ftp):\/\/[a-zA-Z0-9:.\[\]#-]+(?:\/[^\s]*[^\s.,?!]|[^\s\u{80}-\u{10ffff}.,?!])/gui
        const matches = this._text.matchAll(regex);
        for (let match of matches) {
            const link = match[0];
            this._handleText(match);
            this._message.insertLink(link, link);
        }
        this._handleText();
        return this._message;
    }
}
