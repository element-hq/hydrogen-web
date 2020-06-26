export const EVENT_TYPE = "m.room.member";

export class RoomMember {
    constructor(data) {
        this._data = data;
    }

    static async updateOrCreateMember(roomId, memberData, memberEvent) {
        if (!memberEvent) {
            return;
        }
        
        const userId = memberEvent.state_key;
        const {content} = memberEvent;
        
        if (!userId || !content) {
            return;
        }

        let member;
        if (memberData) {
            member = new RoomMember(memberData);
            member.updateWithMemberEvent(memberEvent);
        } else {
            member = RoomMember.fromMemberEvent(this._roomId, memberEvent);
        }
        return member;
    }

    static fromMemberEvent(roomId, memberEvent) {
        const userId = memberEvent && memberEvent.state_key;
        if (!userId) {
            return;
        }

        const member = new RoomMember({
            roomId: roomId,
            userId: userId,
            avatarUrl: null,
            displayName: null,
            membership: null,
            deviceTrackingStatus: 0,
        });
        member.updateWithMemberEvent(memberEvent);
        return member;
    }

    get roomId() {
        return this._data.roomId;
    }

    get userId() {
        return this._data.userId;
    }

    updateWithMemberEvent(event) {
        if (!event || !event.content) {
            return;
        }
        const {content} = event;
        this._data.membership = content.membership;
        this._data.avatarUrl = content.avatar_url;
        this._data.displayName = content.displayname;
    }

    serialize() {
        return this.data;
    }
}
