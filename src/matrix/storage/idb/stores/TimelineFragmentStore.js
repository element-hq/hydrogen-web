export default class RoomFragmentStore {
    constructor(store) {
        this._store = store;
    }

    _allRange(roomId) {
        return IDBKeyRange.bound(
            [roomId, Number.MIN_SAFE_INTEGER],
            [roomId, Number.MAX_SAFE_INTEGER]
        );
    }

    all(roomId) {
        return this._store.selectAll(this._allRange(roomId));
    }

    /** Returns the fragment without a nextToken and without nextId,
    if any, with the largest id if there are multiple (which should not happen) */
    liveFragment(roomId) {
        // why do we need this?
        // Ok, take the case where you've got a /context fragment and a /sync fragment
        // They are not connected. So, upon loading the persister, which one do we take? We can't sort them ...
        // we assume that the one without a nextToken and without a nextId is a live one
        // there should really be only one like this

        // reverse because assuming live fragment has bigger id than non-live ones
        return this._store.findReverse(this._allRange(roomId), fragment => {
            return typeof fragment.nextId !== "number" && typeof fragment.nextToken !== "string";
        });
    }

    // should generate an id an return it?
    // depends if we want to do anything smart with fragment ids,
    // like give them meaning depending on range. not for now probably ...
    add(fragment) {
        return this._store.add(fragment);
    }

    update(fragment) {
        return this._store.put(fragment);
    }

    get(roomId, fragmentId) {
        return this._store.get([roomId, fragmentId]);
    }
}
