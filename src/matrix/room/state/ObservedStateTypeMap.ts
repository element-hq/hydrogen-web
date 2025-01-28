/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {StateObserver} from "./types";
import type {StateEvent} from "../../storage/types";
import type {Transaction} from "../../storage/idb/Transaction";
import {ObservableMap} from "../../../observable/map";

/**
 * Observable map for a given type with state keys as map keys.
 * Unsubscribes when last subscription is removed */
export class ObservedStateTypeMap extends ObservableMap<string, StateEvent> implements StateObserver {
    private removeCallback?: () => void;
    
    constructor(private readonly type: string) {
        super();
    }
    /** @internal */
    async load(roomId: string, txn: Transaction): Promise<void> {
        const events = await txn.roomState.getAllForType(roomId, this.type);
        for (let i = 0; i < events.length; ++i) {
            const {event} = events[i];
            this.add(event.state_key, event);
        }
    }
    /** @internal */
    handleStateEvent(event: StateEvent) {
        if (event.type === this.type) {
            this.set(event.state_key, event);
        }
    }

    setRemoveCallback(callback: () => void) {
        this.removeCallback = callback;
    }

    onUnsubscribeLast() {
        this.removeCallback?.();
    }
}
