export const EVENT_TYPE = "m.room.member";

export class RoomMember {
    constructor(data) {
        this._data = data;
    }

    static fromMemberEvent(roomId, memberEvent) {
        const userId = memberEvent && memberEvent.state_key;
        if (typeof userId !== "string") {
            return;
        }
        const {content} = memberEvent;
        const membership = content?.membership;
        const avatarUrl = content?.avatar_url;
        const displayName = content?.displayname;
        if (typeof membership !== "string") {
            return;
        }
        return new RoomMember({
            roomId,
            userId,
            membership,
            avatarUrl,
            displayName,
        });
    }

    get roomId() {
        return this._data.roomId;
    }

    get userId() {
        return this._data.userId;
    }

    serialize() {
        return this._data;
    }
}
