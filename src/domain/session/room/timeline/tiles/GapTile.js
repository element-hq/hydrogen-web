import SimpleTile from "./SimpleTile.js";

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
            // this._emitUpdate("isLoading");
            try {
                await this._timeline.fillGap(this._entry, 10);
            } catch (err) {
                console.error(`timeline.fillGap(): ${err.message}:\n${err.stack}`);
                this._error = err;
                // this._emitUpdate("error");
            } finally {
                this._loading = false;
                // this._emitUpdate("isLoading");
            }
        }
    }

    get shape() {
        return "gap";
    }

    get isLoading() {
        return this._loading;
    }

    get isUp() {
        return this._entry.direction.isBackward;
    }

    get isDown() {
        return this._entry.direction.isForward;
    }

    get error() {
        if (this._error) {
            const dir = this._entry.prev_batch ? "previous" : "next";
            return `Could not load ${dir} messages: ${this._error.message}`;
        }
        return null;
    }
}
