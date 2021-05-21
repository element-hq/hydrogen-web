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

import {BaseEntry} from "./BaseEntry.js";
import {REDACTION_TYPE} from "../../common.js";

export class BaseEventEntry extends BaseEntry {
    constructor(fragmentIdComparer) {
        super(fragmentIdComparer);
        this._localRedactCount = 0;
    }

    get isRedacted() {
        return this._localRedactCount > 0;
    }

    /**
        aggregates local relation.
        @return [string] returns the name of the field that has changed, if any
    */
    addLocalRelation(entry) {
        if (entry.eventType === REDACTION_TYPE) {
            this._localRedactCount += 1;
            if (this._localRedactCount === 1) {
                return "isRedacted";
            }
        }
    }
    
    /**
        deaggregates local relation.
        @return [string] returns the name of the field that has changed, if any
    */
    removeLocalRelation(entry) {
        if (entry.eventType === REDACTION_TYPE) {
            this._localRedactCount -= 1;
            if (this._localRedactCount === 0) {
                return "isRedacted";
            }
        }
    }
}