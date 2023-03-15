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
import {BaseObservableValue} from "../../../observable/value";

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

import {createMockStorage} from "../../../mocks/Storage";

export async function tests() {
    return {
        "test load and update": async assert => {
            const storage = await createMockStorage();
            const writeTxn = await storage.readWriteTxn([storage.storeNames.roomState]);
            writeTxn.roomState.set("!abc", {
                event_id: "$abc",
                type: "m.room.member",
                state_key: "@alice",
                sender: "@alice",
                origin_server_ts: 5,
                content: {}
            });
            await writeTxn.complete();
            const txn = await storage.readTxn([storage.storeNames.roomState]);
            const value = new ObservedStateKeyValue("m.room.member", "@alice");
            await value.load("!abc", txn);
            const updates: Array<StateEvent | undefined> = [];
            assert.strictEqual(value.get()?.origin_server_ts, 5);
            const unsubscribe = value.subscribe(value => updates.push(value));
            value.handleStateEvent({
                event_id: "$abc",
                type: "m.room.member",
                state_key: "@bob",
                sender: "@alice",
                origin_server_ts: 10,
                content: {}
            });
            assert.strictEqual(updates.length, 0);
            value.handleStateEvent({
                event_id: "$abc",
                type: "m.room.member",
                state_key: "@alice",
                sender: "@alice",
                origin_server_ts: 10,
                content: {}
            });
            assert.strictEqual(updates.length, 1);
            assert.strictEqual(updates[0]?.origin_server_ts, 10);
            let removed = false;
            value.setRemoveCallback(() => removed = true);
            unsubscribe();
            assert(removed);
        }
    }
}
