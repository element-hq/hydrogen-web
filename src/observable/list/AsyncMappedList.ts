/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
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

import {IListObserver} from "./BaseObservableList";
import {BaseMappedList, runAdd, runUpdate, runRemove, runMove, runReset} from "./BaseMappedList";

export class AsyncMappedList<F,T> extends BaseMappedList<F,T,Promise<T>> implements IListObserver<F> {
    private _eventQueue: AsyncEvent<F>[] | null = null;
    private _flushing: boolean = false;

    onSubscribeFirst(): void {
        this._sourceUnsubscribe = this._sourceList.subscribe(this);
        this._eventQueue = [];
        this._mappedValues = [];
        let idx = 0;
        for (const item of this._sourceList) {
            this._eventQueue.push(new AddEvent(idx, item));
            idx += 1;
        }
        void this._flush();
    }

    async _flush(): Promise<void> {
        if (this._flushing) {
            return;
        }
        this._flushing = true;
        try {
            while (this._eventQueue!.length) {
                const event = this._eventQueue!.shift();
                await event!.run(this);
            }
        } finally {
            this._flushing = false;
        }
    }

    onReset(): void {
        if (this._eventQueue) {
            this._eventQueue.push(new ResetEvent());
            void this._flush();
        }
    }

    onAdd(index: number, value: F): void {
        if (this._eventQueue) {
            this._eventQueue.push(new AddEvent(index, value));
            void this._flush();
        }
    }

    onUpdate(index: number, value: F, params: any): void {
        if (this._eventQueue) {
            this._eventQueue.push(new UpdateEvent(index, value, params));
            void this._flush();
        }
    }

    onRemove(index: number): void {
        if (this._eventQueue) {
            this._eventQueue.push(new RemoveEvent(index));
            void this._flush();
        }
    }

    onMove(fromIdx: number, toIdx: number): void {
        if (this._eventQueue) {
            this._eventQueue.push(new MoveEvent(fromIdx, toIdx));
            void this._flush();
        }
    }

    onUnsubscribeLast(): void {
        this._sourceUnsubscribe!();
        this._eventQueue = null;
        this._mappedValues = null;
    }
}

type AsyncEvent<F> = AddEvent<F> | UpdateEvent<F> | RemoveEvent<F> | MoveEvent<F> | ResetEvent<F>

class AddEvent<F> {
    constructor(public index: number, public value: F) {}

    async run<T>(list: AsyncMappedList<F,T>): Promise<void> {
        const mappedValue = await list._mapper(this.value);
        runAdd(list, this.index, mappedValue);
    }
}

class UpdateEvent<F> {
    constructor(public index: number, public value: F, public params: any) {}

    async run<T>(list: AsyncMappedList<F,T>): Promise<void> {
        runUpdate(list, this.index, this.value, this.params);
    }
}

class RemoveEvent<F> {
    constructor(public index: number) {}

    async run<T>(list: AsyncMappedList<F,T>): Promise<void> {
        runRemove(list, this.index);
    }
}

class MoveEvent<F> {
    constructor(public fromIdx: number, public toIdx: number) {}

    async run<T>(list: AsyncMappedList<F,T>): Promise<void> {
        runMove(list, this.fromIdx, this.toIdx);
    }
}

class ResetEvent<F> {
    async run<T>(list: AsyncMappedList<F,T>): Promise<void> {
        runReset(list);
    }
}

import {ObservableArray} from "./ObservableArray";
import {ListObserver} from "../../mocks/ListObserver.js";


// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tests() {
    return {
        "events are emitted in order": async (assert): Promise<void> => {
            const double = (n: number): number => n * n;
            const source = new ObservableArray<number>();
            const mapper = new AsyncMappedList(source, async n => {
                await new Promise(r => setTimeout(r, n));
                return {n: double(n)};
            }, (o, params, n) => {
                o.n = double(n);
            });
            const observer = new ListObserver();
            mapper.subscribe(observer);
            source.append(2); // will sleep this amount, so second append would take less time
            source.append(1);
            source.update(0, 7, "lucky seven");
            source.remove(0);
            {
                const {type, index, value} = await observer.next();
                assert.equal(mapper.length, 1);
                assert.equal(type, "add");
                assert.equal(index, 0);
                assert.equal(value.n, 4);
            }
            {
                const {type, index, value} = await observer.next();
                assert.equal(mapper.length, 2);
                assert.equal(type, "add");
                assert.equal(index, 1);
                assert.equal(value.n, 1);
            }
            {
                const {type, index, value, params} = await observer.next();
                assert.equal(mapper.length, 2);
                assert.equal(type, "update");
                assert.equal(index, 0);
                assert.equal(value.n, 49);
                assert.equal(params, "lucky seven");
            }
            {
                const {type, index, value} = await observer.next();
                assert.equal(mapper.length, 1);
                assert.equal(type, "remove");
                assert.equal(index, 0);
                assert.equal(value.n, 49);
            }
        }
    };
}
