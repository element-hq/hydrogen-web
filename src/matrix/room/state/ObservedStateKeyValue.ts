/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
