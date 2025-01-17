/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
