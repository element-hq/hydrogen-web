/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

export function groupBy<K, V>(array: V[], groupFn: (V) => K): Map<K, V[]> {
    return groupByWithCreator<K, V, V[]>(array, groupFn,
        () => {return [];},
        (array, value) => array.push(value)
    );
}

export function groupByWithCreator<K, V, C>(array: V[], groupFn: (V) => K, createCollectionFn: () => C, addCollectionFn: (C, V) => void): Map<K, C> {
    return array.reduce((map, value) => {
        const key = groupFn(value);
        let collection = map.get(key);
        if (!collection) {
            collection = createCollectionFn();
            map.set(key, collection);
        }
        addCollectionFn(collection, value);
        return map;
    }, new Map<K, C>());
}

export function countBy<V>(events: V[], mapper: (V) => string | number): { [key: string]: number } {
    return events.reduce((counts, event) => {
        const mappedValue = mapper(event);
        if (!counts[mappedValue]) {
            counts[mappedValue] = 1;
        } else {
            counts[mappedValue] += 1;
        }
        return counts;
    }, {});
}

export function tests() {
    return {
        countBy: assert => {
            const counts = countBy([{type: "foo"}, {type: "bar"}, {type: "foo"}], o => o.type);
            assert.equal(Object.keys(counts).length, 2);
            assert.equal(counts.foo, 2);
            assert.equal(counts.bar, 1);
        }
    }
}
