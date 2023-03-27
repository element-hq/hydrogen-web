/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
