import BaseObservableList from "../BaseObservableList.js";


/*

when a value changes, it sorting order can change. It would still be at the old index prior to firing an onChange event.
So how do you know where it was before it changed, if not by going over all values?

how to make this fast?

seems hard to solve with an array, because you need to map the key to it's previous location somehow, to efficiently find it,
and move it.

I wonder if we could do better with a binary search tree (BST).
The tree has a value with {key, value}. There is a plain Map mapping keys to this tuple,
for easy lookup. Now how do we find the index of this tuple in the BST?

either we store in every node the amount of nodes on the left and right, or we decend into the part
of the tree preceding the node we want to know about. Updating the counts upwards would probably be fine as this is log2 of
the size of the container.

to be able to go from a key to an index, the value would have the have a link with the tree node though

so key -> Map<key,value> -> value -> node -> *parentNode -> rootNode
with a node containing {value, leftCount, rightCount, leftNode, rightNode, parentNode}
*/


/**
 * @license
 * Based off baseSortedIndex function in Lodash <https://lodash.com/>
 * Copyright JS Foundation and other contributors <https://js.foundation/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */
function sortedIndex(array, value, comparator) {
    let low = 0;
    let high = array.length;

    while (low < high) {
        let mid = (low + high) >>> 1;
        let cmpResult = comparator(value, array[mid]);

        if (cmpResult > 0) {
            low = mid + 1;
        } else if (cmpResult < 0) {
            high = mid;
        } else {
            low = high = mid;
        }
    }
    return high;
}
// no duplicates allowed for now
export default class SortOperator extends BaseObservableList {
    constructor(sourceMap, comparator, getKey) {
        super();
        this._sourceMap = sourceMap;
        this._comparator = comparator;
        this._getKey = getKey;
        this._sortedValues = [];
    }
    
    onAdd(key, value) {
        const idx = sortedIndex(this._sortedValues, value, this._comparator);
        this._sortedValues.splice(idx, 0, value);
        this.emitAdd(idx, value);
    }

    onRemove(key, value) {
        const idx = sortedIndex(this._sortedValues, value, this._comparator);
        this._sortedValues.splice(idx, 1);
        this.emitRemove(idx, value);
    }

    onChange(key, value, params) {
        const idxIfSortUnchanged = sortedIndex(this._sortedValues, value, this._comparator);
        if (this._getKey(this._sortedValues[idxIfSortUnchanged]) === key) {
            this.emitChange(idxIfSortUnchanged, value, params);
        } else {
            // TODO: slow!? See above for idea with BST to speed this up if we need to
            const oldIdx = this._sortedValues.find(v => this._getKey(v) === key);
            this._sortedValues.splice(oldIdx, 1);
            const newIdx = sortedIndex(this._sortedValues, value, this._comparator);
            this._sortedValues.splice(newIdx, 0, value);
            this.emitMove(oldIdx, newIdx, value);
            this.emitChange(newIdx, value, params);
        }
    }

    onReset() {
        this._sortedValues = [];
        this.emitReset();
    }

    onSubscribeFirst() {
        this._mapSubscription = this._sourceMap.subscribe(this);
        this._sortedValues = new Array(this._sourceMap.size);
        let i = 0;
        for (let [, value] of this._sourceMap) {
            this._sortedValues[i] = value;
            ++i;
        }
        this._sortedValues.sort(this._comparator);
        super.onSubscribeFirst();
    }

    onUnsubscribeLast() {
        super.onUnsubscribeLast();
        this._sortedValues = null;
        this._mapSubscription = this._mapSubscription();
    }


    get length() {
        return this._sourceMap.size;
    }

    [Symbol.iterator]() {
        return this._sortedValues;
    }
}

//#ifdef TESTS
export function tests() {
    return {
        test_sortIndex(assert) {
            let idx = sortedIndex([1, 5, 6, 8], 0, (a, b) => a - b);
            assert.equal(idx, 0);
            idx = sortedIndex([1, 5, 6, 8], 3, (a, b) => a - b);
            assert.equal(idx, 1);
            idx = sortedIndex([1, 5, 6, 8], 8, (a, b) => a - b);
            assert.equal(idx, 3);
        },

        test_sortIndex_reverse(assert) {
            let idx = sortedIndex([8, 6, 5, 1], 6, (a, b) => b - a);
            assert.equal(idx, 1);
        },

        test_sortIndex_likeArraySort(assert) {
            const a = [5, 1, 8, 2];
            const cmp = (a, b) => a - b;
            a.sort(cmp);
            assert.deepEqual(a, [1, 2, 5, 8]);
            let idx = sortedIndex(a, 2, cmp);
            assert.equal(idx, 1);
        }
    }
}
//#endif
