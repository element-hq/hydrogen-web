import Operator from "../Operator.js";

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

// TODO: this should not inherit from an BaseObservableMap, as it's a list
export default class SortOperator extends Operator {
    constructor(sourceMap, comparator) {
        super(sourceMap);
        this._comparator = comparator;
        this._sortedValues = [];
        this._keyIndex = new Map();
    }
    
    onAdd(key, value) {
        const idx = sortedIndex(this._sortedValues, value, this._comparator);
        this._sortedValues.splice(idx, 0, value);
        this._keyIndex.set(key, idx);
        this.emitAdd(idx, value);
    }

    onRemove(key, _value) {
        const idx = sortedIndex(this._sortedValues, value, this._comparator);
        this._sortedValues.splice(idx, 0, value);
        this._keyIndex.set(key, idx);
        this.emitAdd(idx, value);
    }

    onChange(key, value, params) {
        // index could have moved if other items got added in the meantime
        const oldIdx = this._keyIndex.get(key);
        this._sortedValues.splice(oldIdx, 1);
        const idx = sortedIndex(this._sortedValues, value, this._comparator);

    }

    onSubscribeFirst() {
        this._sortedValues = new Array(this._source.size);
        let i = 0;
        for (let [key, value] of this._source) {
            this._sortedValues[i] = value;
            this._keyIndex.set(key, i);
            ++i;
        }
        this._sortedValues.sort(this._comparator);
        super.onSubscribeFirst();
    }

    onUnsubscribeLast() {
        super.onUnsubscribeLast();
        this._sortedValues = null;
    }

    onReset() {
        this._sortedValues = [];
        this.emitReset();
    }

    get length() {
        return this._source.size;
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
