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

export class Store {
    constructor(storeValue, writable) {
        this._storeValue = storeValue;
        this._writable = writable;
    }

    // makes a copy deep enough that any modifications in the store
    // won't affect the original
    // used for transactions
    cloneStoreValue() {
        // assumes 1 level deep is enough, and that values will be replaced
        // rather than updated.
        if (Array.isArray(this._storeValue)) {
            return this._storeValue.slice();
        } else if (typeof this._storeValue === "object") {
            return Object.assign({}, this._storeValue);
        } else {
            return this._storeValue;
        }
    }

    assertWritable() {
        if (!this._writable) {
            throw new Error("Tried to write in read-only transaction");
        }
    }
}
