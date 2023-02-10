/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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
import type {SubscriptionHandle} from "../BaseObservable";

export class FlatMapObservableValue<P, C> extends BaseObservableValue<C | undefined> {
    private sourceSubscription?: SubscriptionHandle;
    private targetSubscription?: SubscriptionHandle;

    constructor(
        private readonly source: BaseObservableValue<P>,
        private readonly mapper: (value: P) => (BaseObservableValue<C> | undefined)
    ) {
        super();
    }

    onUnsubscribeLast(): void {
        super.onUnsubscribeLast();
        this.sourceSubscription = this.sourceSubscription!();
        if (this.targetSubscription) {
            this.targetSubscription = this.targetSubscription();
        }
    }

    onSubscribeFirst(): void {
        super.onSubscribeFirst();
        this.sourceSubscription = this.source.subscribe(() => {
            this.updateTargetSubscription();
            this.emit(this.get());
        });
        this.updateTargetSubscription();
    }

    private updateTargetSubscription(): void {
        const sourceValue = this.source.get();
        if (sourceValue) {
            const target = this.mapper(sourceValue);
            if (target) {
                if (!this.targetSubscription) {
                    this.targetSubscription = target.subscribe(() => this.emit(this.get()));
                }
                return;
            }
        }
        // if no sourceValue or target
        if (this.targetSubscription) {
            this.targetSubscription = this.targetSubscription();
        }
    }

    get(): C | undefined {
        const sourceValue = this.source.get();
        if (!sourceValue) {
            return undefined;
        }
        const mapped = this.mapper(sourceValue);
        return mapped?.get();
    }
}

import {ObservableValue} from "./ObservableValue";

export function tests() {
    return {
        "flatMap.get": (assert): void => {
            const a = new ObservableValue<undefined | {count: ObservableValue<number>}>(undefined);
            const countProxy = a.flatMap(a => a!.count);
            assert.strictEqual(countProxy.get(), undefined);
            const count = new ObservableValue<number>(0);
            a.set({count});
            assert.strictEqual(countProxy.get(), 0);
        },
        "flatMap update from source": (assert): void => {
            const a = new ObservableValue<undefined | {count: ObservableValue<number>}>(undefined);
            const updates: (number | undefined)[] = [];
            a.flatMap(a => a!.count).subscribe(count => {
                updates.push(count);
            });
            const count = new ObservableValue<number>(0);
            a.set({count});
            assert.deepEqual(updates, [0]);
        },
        "flatMap update from target": (assert): void => {
            const a = new ObservableValue<undefined | {count: ObservableValue<number>}>(undefined);
            const updates: (number | undefined)[] = [];
            a.flatMap(a => a!.count).subscribe(count => {
                updates.push(count);
            });
            const count = new ObservableValue<number>(0);
            a.set({count});
            count.set(5);
            assert.deepEqual(updates, [0, 5]);
        }
    };
}
