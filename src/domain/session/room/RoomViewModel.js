import EventEmitter from "../../../EventEmitter.js";

export default class RoomViewModel extends EventEmitter {
    constructor(room) {
        super();
        this._room = room;
        this._timeline = null;
        this._onRoomChange = this._onRoomChange.bind(this);
        this._timelineError = null;
    }

    async enable() {
        this._room.on("change", this._onRoomChange);
        try {
            this._timeline = await this._room.openTimeline();
            this.emit("change", "timelineEntries");
        } catch (err) {
            this._timelineError = err;
            this.emit("change", "error");
        }
    }

    disable() {
        if (this._timeline) {
            this._timeline.close();
        }
    }

    // room doesn't tell us yet which fields changed,
    // so emit all fields originating from summary
    _onRoomChange() {
        this.emit("change", "name");
    }

    get name() {
        return this._room.name;
    }

    get timelineEntries() {
        return this._timeline && this._timeline.entries;
    }

    get error() {
        if (this._timelineError) {
            return `Something went wrong loading the timeline: ${this._timelineError.message}`;
        }
        return null;
    }
}
