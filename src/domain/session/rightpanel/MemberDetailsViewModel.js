import {ViewModel} from "../../ViewModel.js";
import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar.js";

export class MemberDetailsViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._observableMember = options.observableMember;
        this._mediaRepository = options.mediaRepository;
        this._member = this._observableMember.get();
        this.track(this._observableMember.subscribe( () => this._onMemberChange()));
    }

    get name() { return this._member.name; }
    get userId() { return this._member.userId; }

    get type() { return "member-details"; }

    _onMemberChange() {
        this._member = this._observableMember.get();
        this.emitChange();
    }

    get avatarLetter() {
        return avatarInitials(this.name);
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this.userId)
    }

    avatarUrl(size) {
        return getAvatarHttpUrl(this._member.avatarUrl, size, this.platform, this._mediaRepository);
    }

    get avatarTitle() {
        return this.name;
    }
}
