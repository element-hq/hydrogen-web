/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {BaseObservableValue} from "../../observable/value";

export class ObservedEventMap {
    constructor(notifyEmpty) {
        this._map = new Map();
        this._notifyEmpty = notifyEmpty;
    }

    observe(eventId, eventEntry = null) {
        let observable = this._map.get(eventId);
        if (!observable) {
            observable = new ObservedEvent(this, eventEntry, eventId);
            this._map.set(eventId, observable);
        }
        return observable;
    }

    updateEvents(eventEntries) {
        for (let i = 0; i < eventEntries.length; i += 1) {
            const entry = eventEntries[i];
            const observable = this._map.get(entry.id);
            observable?.update(entry);
        }
    }

    _remove(id) {
        this._map.delete(id);
        if (this._map.size === 0) {
            this._notifyEmpty();
        }
    }
}

class ObservedEvent extends BaseObservableValue {
    constructor(eventMap, entry, id) {
        super();
        this._eventMap = eventMap;
        this._entry = entry;
        this._id = id;
        // remove subscription in microtask after creating it
        // otherwise ObservedEvents would easily never get
        // removed if you never subscribe
        Promise.resolve().then(() => {
            if (!this.hasSubscriptions) {
                this._eventMap._remove(this._id);
                this._eventMap = null;
            }
        });
    }

    subscribe(handler) {
        if (!this._eventMap) {
            throw new Error("ObservedEvent expired, subscribe right after calling room.observeEvent()");
        }
        return super.subscribe(handler);
    }

    onUnsubscribeLast() {
        this._eventMap._remove(this._id);
        this._eventMap = null;
        super.onUnsubscribeLast();
    }

    update(entry) {
        // entries are mostly updated in-place,
        // apart from when they are created,
        // but doesn't hurt to reassign
        this._entry = entry;
        this.emit(this._entry);
    }

    get() {
        return this._entry;
    }
}
