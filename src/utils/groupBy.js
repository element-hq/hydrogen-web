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

export function groupBy(array, groupFn) {
    return groupByWithCreator(array, groupFn,
        () => {return [];},
        (array, value) => array.push(value)
    );
}

export function groupByWithCreator(array, groupFn, createCollectionFn, addCollectionFn) {
    return array.reduce((map, value) => {
        const key = groupFn(value);
        let collection = map.get(key);
        if (!collection) {
            collection = createCollectionFn();
            map.set(key, collection);
        }
        addCollectionFn(collection, value);
        return map;
    }, new Map());
}

export function countBy(events, mapper) {
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
