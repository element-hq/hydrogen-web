export default class UpdateAction {
    constructor(remove, update, updateParams) {
        this._remove = remove;
        this._update = update;
        this._updateParams = updateParams;
    }

    get shouldRemove() {
        return this._remove;
    }

    get shouldUpdate() {
        return this._update;
    }

    get updateParams() {
        return this._updateParams;
    }

    static Remove() {
        return new UpdateAction(true, false, null);
    }

    static Update(newParams) {
        return new UpdateAction(false, true, newParams);
    }

    static Nothing() {
        return new UpdateAction(false, false, null);
    }
}
