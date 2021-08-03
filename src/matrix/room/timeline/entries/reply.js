
export function fallbackBlurb(msgtype) {
    switch (msgtype) {
        case "m.file":
            return "sent a file.";
        case "m.image":
            return "sent an image.";
        case "m.video":
            return "sent a video.";
        case "m.audio":
            return "sent an audio file.";
    }
    return null;
}

export function fallbackPrefix(msgtype) {
    return msgtype === "m.emote" ? "* " : "";
}

export function createReply(targetId, msgtype, body, formattedBody) {
    return {
        msgtype,
        body,
        "format": "org.matrix.custom.html",
        "formatted_body": formattedBody,
        "m.relates_to": {
            "m.in_reply_to": {
                "event_id": targetId
            }
        }
    };
}

