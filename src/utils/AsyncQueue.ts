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

export class AsyncQueue<T, V> {
    private isRunning = false;
    private queue: T[] = [];
    private error?: Error;

    constructor(
        private readonly reducer: (v: V, t: T) => Promise<V>,
        private value: V,
        private readonly contains: (t: T, queue: T[]) => boolean = (t, queue) => queue.includes(t)
    ) {}

    push(t: T) {
        if (this.contains(t, this.queue)) {
            return;
        }
        this.queue.push(t);
        this.runLoopIfNeeded();
    }

    private async runLoopIfNeeded() {
        if (this.isRunning || this.error) {
            return;
        }
        this.isRunning = true;
        try {
            let item: T | undefined;
            while (item = this.queue.shift()) {
                this.value = await this.reducer(this.value, item);
            }
        } catch (err) {
            this.error = err;
        } finally {
            this.isRunning = false;
        }
    }
}
