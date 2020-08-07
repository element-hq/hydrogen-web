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

export class Direction {
    constructor(isForward) {
        this._isForward = isForward;
    }

    get isForward() {
        return this._isForward;
    }

    get isBackward() {
        return !this.isForward;
    }

    asApiString() {
        return this.isForward ? "f" : "b";
    }

    reverse() {
        return this.isForward ? Direction.Backward : Direction.Forward
    }

    static get Forward() {
        return _forward;
    }

    static get Backward() {
        return _backward;
    }
}

const _forward = Object.freeze(new Direction(true));
const _backward = Object.freeze(new Direction(false));
