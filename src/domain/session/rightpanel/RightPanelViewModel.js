import {ViewModel} from "../../ViewModel.js";
import {RoomDetailsViewModel} from "./RoomDetailsViewModel.js";
import {MemberListViewModel} from "./MemberListViewModel.js";
import {MemberDetailsViewModel} from "./MemberDetailsViewModel.js";

export class RightPanelViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._room = options.room;
        this._setupNavigation();
    }

    get activeViewModel() { return this._activeViewModel; }

    async _getMemberListArguments() {
        const members = await this._room.loadMemberList();
        const room = this._room;
        const powerLevelsObservable = await this._room.observePowerLevels();
        return {members, powerLevelsObservable, mediaRepository: room.mediaRepository};
    }

    async _getMemberDetailsArguments() {
        const segment = this.navigation.path.get("member"); 
        const userId = segment.value;
        const observableMember = await this._room.observeMember(userId);
        return {observableMember, mediaRepository: this._room.mediaRepository};
    }

    _setupNavigation() {
        this._hookUpdaterToSegment("details", RoomDetailsViewModel, () => { return {room: this._room}; });
        this._hookUpdaterToSegment("members", MemberListViewModel, () => this._getMemberListArguments());
        this._hookUpdaterToSegment("member", MemberDetailsViewModel, () => this._getMemberDetailsArguments());
    }

    _hookUpdaterToSegment(segment, viewmodel, argCreator) {
        const observable = this.navigation.observe(segment);
        const updater = this._setupUpdater(segment, viewmodel, argCreator);
        this.track(observable.subscribe(() => updater()));
    }

    _setupUpdater(segment, viewmodel, argCreator) {
        const updater = async (skipDispose = false) => {
            if (!skipDispose) {
                this._activeViewModel = this.disposeTracked(this._activeViewModel);
            }
            const enable = !!this.navigation.path.get(segment)?.value;
            if (enable) {
                const args = await argCreator();
                this._activeViewModel = this.track(new viewmodel(this.childOptions(args)));
            }
            this.emitChange("activeViewModel");
        };
        updater(true);
        return updater;
    }

    closePanel() {
        const path = this.navigation.path.until("room");
        this.navigation.applyPath(path);
    }

    showPreviousPanel() {
        const segmentName = this.activeViewModel.previousSegmentName;
        if (segmentName) {
            let path = this.navigation.path.until("room");
            path = path.with(this.navigation.segment("right-panel", true));
            path = path.with(this.navigation.segment(segmentName, true));
            this.navigation.applyPath(path);
        }
    }
}
