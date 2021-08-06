/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

function htmlEscape(string) {
    return string.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fallbackForNonTextualMessage(msgtype) {
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

function fallbackPrefix(msgtype) {
    return msgtype === "m.emote" ? "* " : "";
}

function _createReplyContent(targetId, msgtype, body, formattedBody) {
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

export function createReplyContent(entry, msgtype, body) {
    // TODO check for absense of sender / body / msgtype / etc?
    const nonTextual = fallbackForNonTextualMessage(entry.content.msgtype);
    const prefix = fallbackPrefix(entry.content.msgtype);
    const sender = entry.sender;
    const name = entry.displayName || sender;

    const formattedBody = nonTextual || entry.content.formatted_body ||
        (entry.content.body && htmlEscape(entry.content.body)) || "";
    const formattedFallback = `<mx-reply><blockquote>In reply to ${prefix}` +
        `<a href="https://matrix.to/#/${sender}">${name}</a><br />` +
        `${formattedBody}</blockquote></mx-reply>`;

    const plainBody = nonTextual || entry.content.body || "";
    const bodyLines = plainBody.split("\n");
    bodyLines[0] = `> ${prefix}<${sender}> ${bodyLines[0]}`
    const plainFallback = bodyLines.join("\n> ");

    const newBody = plainFallback + '\n\n' + body;
    const newFormattedBody = formattedFallback + htmlEscape(body);
    return _createReplyContent(entry.id, msgtype, newBody, newFormattedBody);
}
