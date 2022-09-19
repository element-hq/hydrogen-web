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

import { TimelineEvent } from "../../storage/types";
import {REDACTION_TYPE} from "../common";

export const REACTION_TYPE = "m.reaction";
export const ANNOTATION_RELATION_TYPE = "m.annotation";

export type Relation = {
    event_id?: string;
    key: string;
    rel_type: string
    "m.in_reply_to"?: {
        event_id?: string;
    }
}
export type Annotation = {
    "m.relates_to": Relation;
};

export type RelationEvent = TimelineEvent & {
    redacts?: string;
}

export function createAnnotation(targetId: string, key: string): Annotation {
    return {
        "m.relates_to": {
            "event_id": targetId,
            key,
            "rel_type": ANNOTATION_RELATION_TYPE
        }
    };
}

export function getRelationTarget(relation: Relation): string | undefined {
    return relation.event_id || relation["m.in_reply_to"]?.event_id;
}

export function setRelationTarget(relation: Relation, target: string | undefined): void {
    if (relation.event_id !== undefined) {
        relation.event_id = target;
    } else if (relation["m.in_reply_to"]) {
        relation["m.in_reply_to"].event_id = target;
    }
}

export function getRelatedEventId(event: RelationEvent): string | undefined {
	if (event.type === REDACTION_TYPE) {
        return event.redacts;
    } else {
        const relation = getRelation(event);
        if (relation) {
            return getRelationTarget(relation);
        }
    }
}

export function getRelationFromContent(content?: Annotation): Relation | undefined {
    return content?.["m.relates_to"];
}

export function getRelation(event: RelationEvent | undefined): Relation | undefined {
	return getRelationFromContent(event?.content as Annotation);
}

