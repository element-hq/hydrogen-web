/*
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

export class BaseUpdateView {
    constructor(value) {
        this._value = value;
        // TODO: can avoid this if we adopt the handleEvent pattern in our EventListener
        this._boundUpdateFromValue = null;
    }

    mount(options) {
        const parentProvidesUpdates = options && options.parentProvidesUpdates;
        if (!parentProvidesUpdates) {
            this._subscribe();
        }
    }

    unmount() {
        this._unsubscribe();
    }

    get value() {
        return this._value;
    }

    _updateFromValue(changedProps) {
        this.update(this._value, changedProps);
    }

    _subscribe() {
        if (typeof this._value?.on === "function") {
            this._boundUpdateFromValue = this._updateFromValue.bind(this);
            this._value.on("change", this._boundUpdateFromValue);
        }
    }

    _unsubscribe() {
        if (this._boundUpdateFromValue) {
            if (typeof this._value.off === "function") {
                this._value.off("change", this._boundUpdateFromValue);
            }
            this._boundUpdateFromValue = null;
        }
    }
}
