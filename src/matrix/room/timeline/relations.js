/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {REDACTION_TYPE} from "../common";

export const REACTION_TYPE = "m.reaction";
export const ANNOTATION_RELATION_TYPE = "m.annotation";
export const REFERENCE_RELATION_TYPE = "m.reference";

export function createAnnotation(targetId, key) {
    return {
        "m.relates_to": {
            "event_id": targetId,
            key,
            "rel_type": ANNOTATION_RELATION_TYPE
        }
    };
}

export function createReference(targetId) {
    return {
        "m.relates_to": {
            "event_id": targetId,
            "rel_type": REFERENCE_RELATION_TYPE
        }
    };
}

export function getRelationTarget(relation) {
    return relation.event_id || relation["m.in_reply_to"]?.event_id
}

export function setRelationTarget(relation, target) {
    if (relation.event_id !== undefined) {
        relation.event_id = target;
    } else if (relation["m.in_reply_to"]) {
        relation["m.in_reply_to"].event_id = target;
    }
}

export function getRelatedEventId(event) {
	if (event.type === REDACTION_TYPE) {
        return event.redacts;
    } else {
        const relation = getRelation(event);
        if (relation) {
            return getRelationTarget(relation);
        }
    }
    return null;
}

export function getRelationFromContent(content) {
    return content?.["m.relates_to"];
}

export function getRelation(event) {
	return getRelationFromContent(event.content);
}

