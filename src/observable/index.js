import SortedMapList from "./list/SortedMapList.js";
import FilteredMap from "./map/FilteredMap.js";
import MappedMap from "./map/MappedMap.js";
import BaseObservableMap from "./map/BaseObservableMap.js";
// re-export "root" (of chain) collections
export { default as ObservableArray } from "./list/ObservableArray.js";
export { default as SortedArray } from "./list/SortedArray.js";
export { default as MappedList } from "./list/MappedList.js";
export { default as ConcatList } from "./list/ConcatList.js";
export { default as ObservableMap } from "./map/ObservableMap.js";

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
