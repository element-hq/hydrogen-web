import SimpleTile from "./SimpleTile.js";

export default class RoomNameTile extends SimpleTile {
    get label() {
        const event = this._entry.event;
        const content = event.content;
        return `${event.sender} changed membership to ${content.membership}`;
    }
}
