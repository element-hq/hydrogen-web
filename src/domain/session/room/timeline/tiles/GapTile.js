import SimpleTile from "./SimpleTile";

export default class GapTile extends SimpleTile {
    constructor(options, timeline) {
        super(options);
        this._timeline = timeline;
        this._loading = false;
        this._error = null;
    }

    async fill() {
        // prevent doing this twice
        if (!this._loading) {
            this._loading = true;
            this._emitUpdate("isLoading");
            try {
                return await this._timeline.fillGap(this._entry, 10);
            } catch (err) {
                this._loading = false;
                this._error = err;
                this._emitUpdate("isLoading");
                this._emitUpdate("error");
            }
        }
    }

    get isLoading() {
        return this._loading;
    }

    get direction() {
        return this._entry.prev_batch ? "backward" : "forward";
    }

    get error() {
        if (this._error) {
            const dir = this._entry.prev_batch ? "previous" : "next";
            return `Could not load ${dir} messages: ${this._error.message}`;
        }
        return null;
    }
}
