import {avatarInitials} from "../avatar.js";

export default class RoomTileViewModel {
    // we use callbacks to parent VM instead of emit because
    // it would be annoying to keep track of subscriptions in
    // parent for all RoomTileViewModels
    // emitUpdate is ObservableMap/ObservableList update mechanism
    constructor({room, emitUpdate, emitOpen}) {
        this._room = room;
        this._emitUpdate = emitUpdate;
        this._emitOpen = emitOpen;
    }

    open() {
        this._emitOpen(this._room);
    }

    compare(other) {
        // sort by name for now
        return this._room.name.localeCompare(other._room.name);
    }

    get name() {
        return this._room.name;
    }

    get avatarInitials() {
        return avatarInitials(this._room.name);
    }
}
