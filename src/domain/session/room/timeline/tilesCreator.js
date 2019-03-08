import GapTile from "./tiles/GapTile.js";
import TextTile from "./tiles/TextTile.js";
import ImageTile from "./tiles/ImageTile.js";
import RoomNameTile from "./tiles/RoomNameTile.js";
import RoomMemberTile from "./tiles/RoomMemberTile.js";

export default function ({timeline}) {
    return function tilesCreator(entry) {
        if (entry.gap) {
            return new GapTile(entry, timeline);
        } else if (entry.event) {
            const event = entry.event;
            switch (event.type) {
                case "m.room.message": {
                    const content = event.content;
                    const msgtype = content && content.msgtype;
                    switch (msgtype) {
                        case "m.text":
                            return new TextTile(entry);
                        case "m.image":
                            return new ImageTile(entry);
                        default:
                            return null;    // unknown tile types are not rendered?
                    }
                }
                case "m.room.name":
                    return new RoomNameTile(entry);
                case "m.room.member":
                    return new RoomMemberTile(entry);
                default:
                    return null;
            }
        }
    }   
}
