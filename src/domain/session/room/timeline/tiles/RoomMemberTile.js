import SimpleTile from "./SimpleTile.js";

export default class RoomNameTile extends SimpleTile {

    get shape() {
        return "announcement";
    }

    get announcement() {
        const {sender, content, prevContent, stateKey} = this._entry;
        const membership = content && content.membership;
        const prevMembership = prevContent && prevContent.membership;

        if (prevMembership === "join" && membership === "join") {
            if (content.avatar_url !== prevContent.avatar_url) {
                return `${stateKey} changed their avatar`; 
            } else if (content.displayname !== prevContent.displayname) {
                return `${stateKey} changed their name to ${content.displayname}`; 
            }
        } else if (membership === "join") {
            return `${stateKey} joined the room`;
        } else if (membership === "invite") {
            return `${stateKey} was invited to the room by ${sender}`;
        } else if (prevMembership === "invite") {
            if (membership === "join") {
                return `${stateKey} accepted the invitation to join the room`;
            } else if (membership === "leave") {
                return `${stateKey} declined the invitation to join the room`;
            }
        } else if (membership === "leave") {
            if (stateKey === sender) {
                return `${stateKey} left the room`;
            } else {
                const reason = content.reason;
                return `${stateKey} was kicked from the room by ${sender}${reason ? `: ${reason}` : ""}`;
            }
        } else if (membership === "ban") {
            return `${stateKey} was banned from the room by ${sender}`;
        }
        
        return `${sender} membership changed to ${content.membership}`;
    }
}
