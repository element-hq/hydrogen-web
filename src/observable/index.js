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

import {SortedMapList} from "./list/SortedMapList";
import {FilteredMap} from "./map/FilteredMap";
import {MappedMap} from "./map/MappedMap";
import {JoinedMap} from "./map/JoinedMap";
import {BaseObservableMap} from "./map/BaseObservableMap";
// re-export "root" (of chain) collections
export { ObservableArray } from "./list/ObservableArray";
export { SortedArray } from "./list/SortedArray";
export { MappedList } from "./list/MappedList";
export { AsyncMappedList } from "./list/AsyncMappedList";
export { ConcatList } from "./list/ConcatList";
export { ObservableMap } from "./map/ObservableMap";

// avoid circular dependency between these classes
// and BaseObservableMap (as they extend it)
Object.assign(BaseObservableMap.prototype, {
    sortValues(comparator) {
        return new SortedMapList(this, comparator);
    },

    mapValues(mapper, updater) {
        return new MappedMap(this, mapper, updater);
    },

    filterValues(filter) {
        return new FilteredMap(this, filter);
    },

    join(...otherMaps) {
        return new JoinedMap([this].concat(otherMaps));
    }
});
