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
    constructor(public readonly isForward: boolean) {
    }

    get isBackward(): boolean {
        return !this.isForward;
    }

    asApiString(): string {
        return this.isForward ? "f" : "b";
    }

    reverse(): Direction {
        return this.isForward ? Direction.Backward : Direction.Forward
    }

    static get Forward(): Direction {
        return _forward;
    }

    static get Backward(): Direction {
        return _backward;
    }
}

const _forward = new Direction(true);
const _backward = new Direction(false);
