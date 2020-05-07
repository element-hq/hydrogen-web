import {BaseObservableList} from "./BaseObservableList.js";

export class MappedList extends BaseObservableList {
    constructor(sourceList, mapper, updater) {
        super();
        this._sourceList = sourceList;
        this._mapper = mapper;
        this._updater = updater;
        this._sourceUnsubscribe = null;
        this._mappedValues = null;
    }

    onSubscribeFirst() {
        this._sourceUnsubscribe = this._sourceList.subscribe(this);
        this._mappedValues = [];
        for (const item of this._sourceList) {
            this._mappedValues.push(this._mapper(item));
        }
    }

    onReset() {
        this._mappedValues = [];
        this.emitReset();
    }

    onAdd(index, value) {
        const mappedValue = this._mapper(value);
        this._mappedValues.splice(index, 0, mappedValue);
        this.emitAdd(index, mappedValue);
    }

    onUpdate(index, value, params) {
        const mappedValue = this._mappedValues[index];
        if (this._updater) {
            this._updater(mappedValue, params, value);
        }
        this.emitUpdate(index, mappedValue, params);
    }

    onRemove(index) {
        const mappedValue = this._mappedValues[index];
        this._mappedValues.splice(index, 1);
        this.emitRemove(index, mappedValue);
    }

    onMove(fromIdx, toIdx) {
        const mappedValue = this._mappedValues[fromIdx];
        this._mappedValues.splice(fromIdx, 1);
        this._mappedValues.splice(toIdx, 0, mappedValue);
        this.emitMove(fromIdx, toIdx, mappedValue);
    }

    onUnsubscribeLast() {
        this._sourceUnsubscribe();
    }

    get length() {
        return this._mappedValues.length;
    }

    [Symbol.iterator]() {
        return this._mappedValues.values();
    }
}

export async function tests() {
    class MockList extends BaseObservableList {
        get length() {
            return 0;
        }
        [Symbol.iterator]() {
            return [].values();
        }
    }

    return {
        test_add(assert) {
            const source = new MockList();
            const mapped = new MappedList(source, n => {return {n: n*n};});
            let fired = false;
            const unsubscribe = mapped.subscribe({
                onAdd(idx, value) {
                    fired = true;
                    assert.equal(idx, 0);
                    assert.equal(value.n, 36);
                }
            });
            source.emitAdd(0, 6);
            assert(fired);
            unsubscribe();
        },
        test_update(assert) {
            const source = new MockList();
            const mapped = new MappedList(
                source,
                n => {return {n: n*n};},
                (o, p, n) => o.m = n*n
            );
            let fired = false;
            const unsubscribe = mapped.subscribe({
                onAdd() {},
                onUpdate(idx, value) {
                    fired = true;
                    assert.equal(idx, 0);
                    assert.equal(value.n, 36);
                    assert.equal(value.m, 49);
                }
            });
            source.emitAdd(0, 6);
            source.emitUpdate(0, 7);
            assert(fired);
            unsubscribe();
        }
    };
}
