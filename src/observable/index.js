import {SortedMapList} from "./list/SortedMapList.js";
import {FilteredMap} from "./map/FilteredMap.js";
import {MappedMap} from "./map/MappedMap.js";
import {BaseObservableMap} from "./map/BaseObservableMap.js";
// re-export "root" (of chain) collections
export { ObservableArray } from "./list/ObservableArray.js";
export { SortedArray } from "./list/SortedArray.js";
export { MappedList } from "./list/MappedList.js";
export { ConcatList } from "./list/ConcatList.js";
export { ObservableMap } from "./map/ObservableMap.js";

// avoid circular dependency between these classes
// and BaseObservableMap (as they extend it)
Object.assign(BaseObservableMap.prototype, {
    sortValues(comparator) {
        return new SortedMapList(this, comparator);
    },

    mapValues(mapper) {
        return new MappedMap(this, mapper);
    },

    filterValues(filter) {
        return new FilteredMap(this, filter);
    }
});
