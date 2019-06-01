import SimpleTile from "./SimpleTile.js";

export default class RoomNameTile extends SimpleTile {
    
    get shape() {
        return "annoucement";
    }

    get label() {
        const event = this._entry.event;
        const content = event.content;
        return `${event.sender} changed the room name to "${content.name}"`
    }
}
