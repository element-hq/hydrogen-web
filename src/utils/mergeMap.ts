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

export function mergeMap<K, V>(src: Map<K, V> | undefined, dst: Map<K, V>): void {
    if (src) {
        for (const [key, value] of src.entries()) {
            dst.set(key, value);
        }
    }
}

export function tests() {
    return {
        "mergeMap with src": assert => {
            const src = new Map();
            src.set(1, "a");
            const dst = new Map();
            dst.set(2, "b");
            mergeMap(src, dst);
            assert.equal(dst.get(1), "a");
            assert.equal(dst.get(2), "b");
            assert.equal(src.get(2), null);
        },
        "mergeMap without src doesn't fail": () => {
            mergeMap(undefined, new Map());
        }
    }
}
