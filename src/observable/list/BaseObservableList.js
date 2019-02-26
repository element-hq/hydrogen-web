import BaseObservableCollection from "../BaseObservableCollection.js";

export default class BaseObservableList extends BaseObservableCollection {
    emitReset() {
        for(let h of this._handlers) {
            h.onReset();
        }
    }
    // we need batch events, mostly on index based collection though?
    // maybe we should get started without?
    emitAdd(index, value) {
        for(let h of this._handlers) {
            h.onAdd(index, value);
        }
    }

    emitUpdate(index, value, params) {
        for(let h of this._handlers) {
            h.onUpdate(index, value, params);
        }
    }

    emitRemove(index, value) {
        for(let h of this._handlers) {
            h.onRemove(index, value);
        }
    }

    // toIdx assumes the item has already
    // been removed from its fromIdx
    emitMove(fromIdx, toIdx, value) {
        for(let h of this._handlers) {
            h.onMove(fromIdx, toIdx, value);
        }
    }

}
