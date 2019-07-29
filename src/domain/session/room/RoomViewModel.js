import EventEmitter from "../../../EventEmitter.js";
import TimelineViewModel from "./timeline/TimelineViewModel.js";
import {avatarInitials} from "../avatar.js";

export default class RoomViewModel extends EventEmitter {
    constructor({room, ownUserId, closeCallback}) {
        super();
        this._room = room;
        this._ownUserId = ownUserId;
        this._timeline = null;
        this._timelineVM = null;
        this._onRoomChange = this._onRoomChange.bind(this);
        this._timelineError = null;
        this._closeCallback = closeCallback;
    }

    async load() {
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

    dispose() {
        // this races with enable, on the await openTimeline()
        if (this._timeline) {
            // will stop the timeline from delivering updates on entries
            this._timeline.close();
        }
    }

    close() {
        this._closeCallback();
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
        return "";
    }

    get avatarInitials() {
        return avatarInitials(this._room.name);
    }

    sendMessage(message) {
        if (message) {
            this._room.sendEvent("m.room.message", {msgtype: "m.text", body: message});
        }
    }
}
