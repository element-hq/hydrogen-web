import GapTile from "./tiles/GapTile.js";
import TextTile from "./tiles/TextTile.js";
import ImageTile from "./tiles/ImageTile.js";
import LocationTile from "./tiles/LocationTile.js";
import RoomNameTile from "./tiles/RoomNameTile.js";
import RoomMemberTile from "./tiles/RoomMemberTile.js";

export default function ({timeline, ownUserId}) {
    return function tilesCreator(entry, emitUpdate) {
        const options = {entry, emitUpdate, ownUserId};
        if (entry.isGap) {
            return new GapTile(options, timeline);
        } else if (entry.event) {
            const event = entry.event;
            switch (event.type) {
                case "m.room.message": {
                    const content = event.content;
                    const msgtype = content && content.msgtype;
                    switch (msgtype) {
                        case "m.text":
                        case "m.notice":
                        case "m.emote":
                            return new TextTile(options);
                        case "m.image":
                            return null; // not supported yet
                            // return new ImageTile(options);
                        case "m.location":
                            return new LocationTile(options);
                        default:
                            // unknown msgtype not rendered
                            return null;
                    }
                }
                case "m.room.name":
                    return new RoomNameTile(options);
                case "m.room.member":
                    return new RoomMemberTile(options);
                default:
                    // unknown type not rendered
                    return null;
            }
        }
    }   
}
