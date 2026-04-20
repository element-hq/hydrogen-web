/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.
Copyright 2024 Mirian Margiani <mixosaurus+ichthyo@pm.me>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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

function _parsePlainBody(plainBody) {
    // Strip any existing reply fallback and return an array of lines.

    const bodyLines = plainBody.trim().split("\n");

    return bodyLines
        .map((elem, index, array) => {
            if (index > 0 && array[index-1][0] !== '>') {
                // stop stripping the fallback at the first line of non-fallback text
                return elem;
            } else if (elem[0] === '>' && elem[1] === ' ') {
                return null;
            } else {
                return elem;
            }
        })
        .filter((elem) => elem !== null)
        // Join, trim, and split to remove any line breaks that were left between the
        // fallback and the actual message body. Don't use trim() because that would
        // also remove any other whitespace at the beginning of the message that the
        // user added intentionally.
        .join('\n')
        .replace(/^\n+|\n+$/g, '')
        .split('\n')
}

function _parseFormattedBody(formattedBody) {
    // Strip any existing reply fallback and return a HTML string again.

    // This is greedy and definitely not the most efficient way to do it.
    // However, this function is only called when sending a reply (so: not too
    // often) and it should make sure that all instances of <mx-reply> are gone.
    return formattedBody.replace(/<mx-reply>[\s\S]*<\/mx-reply>/gi, '');
}

function _createReplyContent(targetId, targetSenderId, msgtype, body, formattedBody) {
    return {
        msgtype,
        body,
        "format": "org.matrix.custom.html",
        "formatted_body": formattedBody,
        "m.relates_to": {
            "m.in_reply_to": {
                "event_id": targetId
            }
        },
        "m.mentions": {
            "user_ids": [
                targetSenderId,
            ]
        }
    };
}

export function createReplyContent(entry, msgtype, body, permaLink) {
    // NOTE We assume sender, body, and msgtype are never invalid because they
    //      are required fields.
    const nonTextual = fallbackForNonTextualMessage(entry.content.msgtype);
    const prefix = fallbackPrefix(entry.content.msgtype);
    const sender = entry.sender;
    const repliedToId = entry.id;

    // TODO collect user mentions (sender and any previous mentions)
    // Considerations:
    // - Who should be included in the mentions? In a reply chain, should all
    //   previous mentions be carried over indefinitely? How to decide when to
    //   stop carrying mentions?
    // - Don't add a mentions section when replying to own messages without
    //   any other mentions. As per https://spec.matrix.org/v1.12/client-server-api/#user-and-room-mentions
    //       "Users should not add their own Matrix ID to the m.mentions property
    //        as outgoing messages cannot self-notify."

    // Generate new plain body with plain reply fallback
    const plainBody = nonTextual || entry.content.body || "";
    const bodyLines = _parsePlainBody(plainBody);
    bodyLines[0] = `> ${prefix}<${sender}> ${bodyLines[0]}`
    const plainFallback = bodyLines.join("\n> ");
    const newBody = plainFallback + '\n\n' + body;

    // Generate new formatted body with formatted reply fallback
    const formattedBody = nonTextual || entry.content.formatted_body ||
        (entry.content.body && htmlEscape(entry.content.body)) || "";
    const cleanedFormattedBody = _parseFormattedBody(formattedBody);
    const formattedFallback =
        `<mx-reply>` +
            `<blockquote>` +
                `<a href="${permaLink}">In reply to</a>` +
                `${prefix}<a href="https://matrix.to/#/${sender}">${sender}</a>` +
                `<br />` +
                `${cleanedFormattedBody}` +
            `</blockquote>` +
        `</mx-reply>`;
    const newFormattedBody = formattedFallback + htmlEscape(body).replaceAll('\n', '<br/>');

    return _createReplyContent(repliedToId, sender, msgtype, newBody, newFormattedBody);
}
