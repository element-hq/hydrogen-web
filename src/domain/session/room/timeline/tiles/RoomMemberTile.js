import SimpleTile from "./SimpleTile.js";

export default class RoomNameTile extends SimpleTile {

    get shape() {
        return "announcement";
    }

    get announcement() {
        const event = this._entry.event;
        const content = event.content;
        switch (content.membership) {
            case "invite": return `${event.state_key} was invited to the room by ${event.sender}`;
            case "join": return `${event.state_key} joined the room`;
            case "leave": {
                if (event.state_key === event.sender) {
                    return `${event.state_key} left the room`;
                } else {
                    const reason = content.reason;
                    return `${event.state_key} was kicked from the room by ${event.sender}${reason ? `: ${reason}` : ""}`;
                }
            }
            case "ban": return `${event.state_key} was banned from the room by ${event.sender}`;
            default: return `${event.sender} membership changed to ${content.membership}`;
        }
    }
}
