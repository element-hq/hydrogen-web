import SimpleTile from "./SimpleTile.js";

export default class RoomNameTile extends SimpleTile {
    
    get shape() {
        return "announcement";
    }

    get announcement() {
        const content = this._entry.content;
        return `${this._entry.sender} named the room "${content.name}"`
    }
}
