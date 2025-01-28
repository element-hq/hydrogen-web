/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export function isValidFragmentId(id) {
    return typeof id === "number";
}

// copied over from matrix-js-sdk, copyright 2016 OpenMarket Ltd
/* _REDACT_KEEP_KEY_MAP gives the keys we keep when an event is redacted
 *
 * This is specified here:
 *  http://matrix.org/speculator/spec/HEAD/client_server/latest.html#redactions
 *
 * Also:
 *  - We keep 'unsigned' since that is created by the local server
 *  - We keep user_id for backwards-compat with v1
 */
const _REDACT_KEEP_KEY_MAP = [
    'event_id', 'type', 'room_id', 'user_id', 'sender', 'state_key', 'prev_state',
    'content', 'unsigned', 'origin_server_ts',
].reduce(function(ret, val) {
    ret[val] = 1; return ret;
}, {});

// a map from event type to the .content keys we keep when an event is redacted
const _REDACT_KEEP_CONTENT_MAP = {
    'm.room.member': {'membership': 1},
    'm.room.create': {'creator': 1},
    'm.room.join_rules': {'join_rule': 1},
    'm.room.power_levels': {'ban': 1, 'events': 1, 'events_default': 1,
                            'kick': 1, 'redact': 1, 'state_default': 1,
                            'users': 1, 'users_default': 1,
                           },
    'm.room.aliases': {'aliases': 1},
};
// end of matrix-js-sdk code

export function redactEvent(redactionEvent, redactedEvent) {
    for (const key of Object.keys(redactedEvent)) {
        if (!_REDACT_KEEP_KEY_MAP[key]) {
            delete redactedEvent[key];
        }
    }
    const { content } = redactedEvent;
    const keepMap = _REDACT_KEEP_CONTENT_MAP[redactedEvent.type];
    for (const key of Object.keys(content)) {
        if (!keepMap?.[key]) {
            delete content[key];
        }
    }
    redactedEvent.unsigned = redactedEvent.unsigned || {};
    redactedEvent.unsigned.redacted_because = redactionEvent;
}
