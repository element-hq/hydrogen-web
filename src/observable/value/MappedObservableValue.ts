/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the 'License');
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an 'AS IS' BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { BaseObservableValue } from "./BaseObservableValue";
import { SubscriptionHandle } from "../BaseObservable";

export class MappedObservableValue<P, C> extends BaseObservableValue<C> {
  private sourceSubscription?: SubscriptionHandle;

  constructor(
      private readonly source: BaseObservableValue<P>,
      private readonly mapper: (value: P) => C
  ) {
      super();
  }

  onUnsubscribeLast() {
      super.onUnsubscribeLast();
      this.sourceSubscription = this.sourceSubscription!();
  }

  onSubscribeFirst() {
      super.onSubscribeFirst();
      this.sourceSubscription = this.source.subscribe(() => {
          this.emit(this.get());
      });
  }

  get(): C {
      const sourceValue = this.source.get();
      return this.mapper(sourceValue);
  }
}