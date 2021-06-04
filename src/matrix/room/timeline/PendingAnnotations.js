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

import {getRelationFromContent} from "./relations.js";

class PendingAnnotations {
    constructor() {
        this.aggregatedAnnotations = new Map();
        this._entries = [];
    }

    add(pendingEventEntry) {
        const relation = getRelationFromContent(pendingEventEntry.content);
        const key = relation.key;
        if (!key) {
            return;
        }
        const count = this.aggregatedAnnotations.get(key) || 0;
        //const addend = pendingEventEntry.isRedacted ? -1 : 1;
        //this.aggregatedAnnotations.set(key, count + addend);
        this.aggregatedAnnotations.set(key, count + 1);
        this._entries.push(pendingEventEntry);
    }

    remove(pendingEventEntry) {
        const idx = this._entries.indexOf(pendingEventEntry);
        if (idx === -1) {
            return;
        }
        this._entries.splice(idx, 1);
        const relation = getRelationFromContent(pendingEventEntry.content);
        const key = relation.key;
        let count = this.aggregatedAnnotations.get(key);
        if (count !== undefined) {
            count -= 1;
            if (count <= 0) {
                this.aggregatedAnnotations.delete(key);
            } else {
                this.aggregatedAnnotations.set(key, count);
            }
        }
    }

    findForKey(key) {
        return this._entries.find(e => {
            const relation = getRelationFromContent(e.content);
            if (relation.key === key) {
                return e;
            }
        });
    }

    get isEmpty() {
        return this._entries.length;
    }
}