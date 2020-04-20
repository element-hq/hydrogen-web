import {SimpleTile} from "./SimpleTile.js";
import {UpdateAction} from "../UpdateAction.js";

export class GapTile extends SimpleTile {
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
            this.emitUpdate("isLoading");
            try {
                await this._timeline.fillGap(this._entry, 10);
            } catch (err) {
                console.error(`timeline.fillGap(): ${err.message}:\n${err.stack}`);
                this._error = err;
                this.emitUpdate("error");
            } finally {
                this._loading = false;
                this.emitUpdate("isLoading");
            }
        }
    }

    updateEntry(entry, params) {
        super.updateEntry(entry, params);
        if (!entry.isGap) {
            return UpdateAction.Remove();
        } else {
            return UpdateAction.Nothing();
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
