import EventEmitter from "../../../EventEmitter.js";
import TimelineViewModel from "./timeline/TimelineViewModel.js";

export default class RoomViewModel extends EventEmitter {
    constructor(room, ownUserId) {
        super();
        this._room = room;
        this._ownUserId = ownUserId;
        this._timeline = null;
        this._timelineVM = null;
        this._onRoomChange = this._onRoomChange.bind(this);
        this._timelineError = null;
    }

    async enable() {
        this._room.on("change", this._onRoomChange);
        try {
            this._timeline = await this._room.openTimeline();
            this._timelineVM = new TimelineViewModel(this._timeline, this._ownUserId);
            this.emit("change", "timelineViewModel");
        } catch (err) {
            console.error(`room.openTimeline(): ${err.message}:\n${err.stack}`);
            this._timelineError = err;
            this.emit("change", "error");
        }
    }

    disable() {
        if (this._timeline) {
            // will stop the timeline from delivering updates on entries
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

    get timelineViewModel() {
        return this._timelineVM;
    }

    get error() {
        if (this._timelineError) {
            return `Something went wrong loading the timeline: ${this._timelineError.message}`;
        }
        return null;
    }
}
