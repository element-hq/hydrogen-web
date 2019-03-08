import MessageTile from "./MessageTile.js";

export default class TextTile extends MessageTile {
    get text() {
        const content = this._getContent();
        return content && content.body;
    }
}
