import MessageTile from "./MessageTile.js";

export default class TextTile extends MessageTile {
    get label() {
        const content = this._getContent();
        const body = content && content.body;
        const sender = this._entry.event.sender;
        if (this._entry.type === "m.emote") {
            return `* ${sender} ${body}`;
        } else {
            return `${sender}: ${body}`;
        }
    }
}
