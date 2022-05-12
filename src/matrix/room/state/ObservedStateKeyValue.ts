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
import {BaseObservableValue} from "../../../observable/value/BaseObservableValue";

/**
 * Observable value for a state event with a given type and state key.
 * Unsubscribes when last subscription is removed */
export class ObservedStateKeyValue extends BaseObservableValue<StateEvent | undefined> implements StateObserver {
    private event?: StateEvent;
    private removeCallback?: () => void;

    constructor(private readonly type: string, private readonly stateKey: string) {
        super();
    }
    /** @internal */
    async load(roomId: string, txn: Transaction): Promise<void> {
        this.event = (await txn.roomState.get(roomId, this.type, this.stateKey))?.event;
    }
    /** @internal */
    handleStateEvent(event: StateEvent) {
        if (event.type === this.type && event.state_key === this.stateKey) {
            this.event = event;
            this.emit(this.get());
        }
    }

    get(): StateEvent | undefined {
        return this.event;
    }

    setRemoveCallback(callback: () => void) {
        this.removeCallback = callback;
    }

    onUnsubscribeLast() {
        this.removeCallback?.();
    }
}
