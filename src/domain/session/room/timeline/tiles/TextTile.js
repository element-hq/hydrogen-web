import {MessageTile} from "./MessageTile.js";

export class TextTile extends MessageTile {
    get text() {
        const content = this._getContent();
        const body = content && content.body;
        if (content.msgtype === "m.emote") {
            return `* ${this._entry.sender} ${body}`;
        } else {
            return body;
        }
    }
}
