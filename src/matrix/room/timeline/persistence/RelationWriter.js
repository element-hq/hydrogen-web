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

import {EventEntry} from "../entries/EventEntry.js";
import {REDACTION_TYPE} from "../../common.js";

export class RelationWriter {
    constructor(roomId, fragmentIdComparer) {
        this._roomId = roomId;
        this._fragmentIdComparer = fragmentIdComparer;
    }

    // this needs to happen again after decryption too for edits
    async writeRelation(sourceEntry, txn, log) {
        if (sourceEntry.relatedEventId) {
            const target = await txn.timelineEvents.getByEventId(this._roomId, sourceEntry.relatedEventId);
            if (target) {
                if (this._applyRelation(sourceEntry, target, log)) {
                    txn.timelineEvents.update(target);
                    return new EventEntry(target, this._fragmentIdComparer);
                }
            }
        }
        return;
    }

    _applyRelation(sourceEntry, targetEntry, log) {
        if (sourceEntry.eventType === REDACTION_TYPE) {
            return log.wrap("redact", log => this._applyRedaction(sourceEntry.event, targetEntry.event, log));
        } else {
            return false;
        }
    }

    _applyRedaction(redactionEvent, targetEvent, log) {
        log.set("redactionId", redactionEvent.event_id);
        log.set("id", targetEvent.event_id);
        // TODO: should we make efforts to preserve the decrypted event type?
        // probably ok not to, as we'll show whatever is deleted as "deleted message"
        // reactions are the only thing that comes to mind, but we don't encrypt those (for now)
        for (const key of Object.keys(targetEvent)) {
            if (!_REDACT_KEEP_KEY_MAP[key]) {
                delete targetEvent[key];
            }
        }
        const {content} = targetEvent;
        const keepMap = _REDACT_KEEP_CONTENT_MAP[targetEvent.type];
        for (const key of Object.keys(content)) {
            if (!keepMap?.[key]) {
                delete content[key];
            }
        }
        targetEvent.unsigned = targetEvent.unsigned || {};
        targetEvent.unsigned.redacted_because = redactionEvent;

        return true;
    }
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