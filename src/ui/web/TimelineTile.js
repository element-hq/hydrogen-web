import * as html from "./html.js";

function tileText(event) {
    const content = event.content;
    switch (event.type) {
        case "m.room.message": {
            const msgtype = content.msgtype;
            switch (msgtype) {
                case "m.text":
                    return content.body;
                default:
                    return `unsupported msgtype: ${msgtype}`;
            }
        }
        case "m.room.name":
            return `changed the room name to "${content.name}"`;
        case "m.room.member":
            return `changed membership to ${content.membership}`;
        default:
            return `unsupported event type: ${event.type}`;
    }
}

export default class TimelineTile {
    constructor(entry) {
        this._entry = entry;
        this._root = null;
    }

    root() {
        return this._root;
    }

    mount() {
        let children;
        if (this._entry.gap) {
            children = [
                html.strong(null, "Gap"),
                " with prev_batch ",
                html.strong(null, this._entry.gap.prev_batch)
            ];
        } else if (this._entry.event) {
            const event = this._entry.event;
            children = [
                html.strong(null, event.sender),
                `: ${tileText(event)}`,
            ];
        }
        this._root = html.li(null, children);
        return this._root;
    }

    unmount() {}

    update() {}
}
