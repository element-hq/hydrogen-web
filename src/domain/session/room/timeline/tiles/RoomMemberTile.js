import SimpleTile from "./SimpleTile.js";

export default class RoomNameTile extends SimpleTile {

    get shape() {
        return "announcement";
    }

    get announcement() {
        const {sender, content, stateKey} = this._entry;
        switch (content.membership) {
            case "invite": return `${stateKey} was invited to the room by ${sender}`;
            case "join": return `${stateKey} joined the room`;
            case "leave": {
                if (stateKey === sender) {
                    return `${stateKey} left the room`;
                } else {
                    const reason = content.reason;
                    return `${stateKey} was kicked from the room by ${sender}${reason ? `: ${reason}` : ""}`;
                }
            }
            case "ban": return `${stateKey} was banned from the room by ${sender}`;
            default: return `${sender} membership changed to ${content.membership}`;
        }
    }
}
