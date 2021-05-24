import { ViewModel } from "../../ViewModel.js";

export class RoomInfoViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._room = options.room;
        this._roomSummary = this._room._summary._data;
    }

    get roomId() {
        return this._room.id;
    }

    get name() {
        return this._roomSummary.name || this._room._heroes?._roomName || this._roomSummary.canonicalAlias;
    }

    get isEncrypted() {
        return !!this._roomSummary.encryption;
    }

    get memberCount() {
        return this._roomSummary.joinCount;
    }
}
