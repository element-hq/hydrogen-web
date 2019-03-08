import SimpleTile from "./SimpleTile";

export default class GapTile extends SimpleTile {
    constructor(entry, timeline) {
        super(entry);
        this._timeline = timeline;
    }

    // GapTile specific behaviour
    fill() {
        return this._timeline.fillGap(this._entry, 10);
    }
}
