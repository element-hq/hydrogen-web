/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export function createEvent(type, id = null, sender = null) {
    return {type, event_id: id, sender};
}

export function withContent(content, event) {
    return Object.assign({}, event, {content});
}

export function withSender(sender, event) {
    return Object.assign({}, event, {sender});
}

export function withTextBody(body, event) {
    return withContent({body, msgtype: "m.text"}, event);
}

export function withTxnId(txnId, event) {
    return Object.assign({}, event, {unsigned: {transaction_id: txnId}});
}

export function withRedacts(redacts, reason, event) {
    return Object.assign({redacts, content: {reason}}, event);
}

export function withReply(replyToId, event) {
    return withContent({
        "m.relates_to": {
            "m.in_reply_to": {
                "event_id": replyToId
            }
        }
    }, event);
}
