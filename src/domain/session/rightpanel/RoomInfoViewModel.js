import {ViewModel} from "../../ViewModel.js";
import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar.js";

export class RoomInfoViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._room = options.room;
        this._roomSummary = this._room._summary._data;
    }

    get roomId() {
        return this._room.id;
    }

    get canonicalAlias() {
        return this._roomSummary.canonicalAlias;
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

    get avatarLetter() {
        return avatarInitials(this.name);
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this.roomId)
    }

    avatarUrl(size) {
        return getAvatarHttpUrl(this._room.avatarUrl, size, this.platform, this._room.mediaRepository);
    }

    get avatarTitle() {
        return this.name;
    }

    closePanel() {
        const path = this.navigation.path.until("room");
        this.navigation.applyPath(path);
    }
}
