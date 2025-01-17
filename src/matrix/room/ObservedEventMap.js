/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
