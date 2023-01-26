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

import {BaseObservableValue} from "./index";
import {BaseObservableMap} from "../map/index";
import type {SubscriptionHandle} from "../BaseObservable";

export type MapReducer<R, K, S> = (
    currentValue: R | undefined,
    addedValue: S | undefined,
    removedValue: S | undefined,
    key: K,
) => R;

export class ReduceMapObservableValue<R, K, V, S> extends BaseObservableValue<R> {
    private reducedValue?: R;
    private subscription?: SubscriptionHandle;

    constructor(
        private readonly map: BaseObservableMap<K, V>,
        private readonly reducer: MapReducer<R, K, S>,
        // this maps the Room to the RoomSummary which is also given as a previousValue in the update event.
        private readonly mapper: (value: V) => S,
        private readonly initialValue: R)
    {
        super();
    }

    onSubscribeFirst(): void {
        this.reducedValue = this.reduceAll();

        this.subscription = this.map.subscribe({
            onAdd(key: K, value: V) {
                this.reducedValue = this.reducer(this.reducedValue, this.mapper(value), undefined, key, this.map);
                this.emit(this.get());
            },
            onRemove(key: K, value: V) {
                this.reducedValue = this.reducer(this.reducedValue, undefined, value, key, this.map);
                this.emit(this.get());
            },
            onUpdate(key: K, value: V, previousValue: P) {
                // TODO: we need to have a preupdate event where we can access the old value
                // first remove (we need the old value here),
                // the problem is that mostly values are updated inline, so we'd have to run updates in a closure or something:
                // map.update(key, value => {
                //    value.foo += 1;
                //    return value;
                // });
                // which emits `preupdate` before running the closure and `update` with the result of the closure.
                // the problem is that this might be hard to integrate with the room update code. We'd have to
                // run `afterSync` in the closure.
                // this would likely bleed into all observable code as events need to be forwarded, and be a massive
                // refactor... Basically, we'd run all inline updates of values in a closure.
                // Quite a big refactor with potentially also a minor performance impact. Is it worth it?

                // perhaps we should manually cache values that we need to remove?
                // the most common example though, reducing notification counts for dividing the room list
                // into DM and Rooms, ... or even for spaces. We actually have the previous value here,
                // the room summary. Perhaps there is a way to make this work just for that use case?
                // E.g. have room.previousRoomSummary available during an update? Or to add an argument
                // to update event with previousValue that can be undefined. That seems like the best idea.
                this.reducedValue = this.reducer(this.reducedValue, undefined, previousValue, key, this.map);
                // then add again
                this.reducedValue = this.reducer(this.reducedValue, this.mapper(value), undefined, key, this.map);
                this.emit(this.get());
            },
            onReset() {
                this.reducedValue = this.reduceAll();
                this.emit(this.get());
            },
        });
    }

    private reduceAll(): R {
        let reducedValue = this.initialValue;
        for (const [key, value] of this.map) {
            // add all existing items
            reducedValue = this.reducer(reducedValue, value, undefined, key, this.map);
        }
        return reducedValue;
    }


    onUnsubscribeLast(): void {
        this.subscription = this.subscription?.();
    }

    get(): R {
        if (this.reducedValue === undefined) {
            return this.reduceAll();
        }
        return this.reducedValue;
    }
}
