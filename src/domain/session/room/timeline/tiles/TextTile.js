import MessageTile from "./MessageTile.js";

export default class TextTile extends MessageTile {
    get label() {
        const content = this._getContent();
        const body = content && content.body;
        if (this._entry.type() === "m.emote") {
            return `* ${this._entry.event.sender} ${body}`;
        } else {
            return body;
        }
    }
}
