/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {ViewModel} from "../../ViewModel.js";
import {RoomDetailsViewModel} from "./RoomDetailsViewModel.js";
import {MemberListViewModel} from "./MemberListViewModel.js";

export class RightPanelViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._room = options.room;
        this._setupNavigation();
    }

    get activeViewModel() { return this._activeViewModel; }

    async _getMemberArguments() {
        const members = await this._room.loadMemberList();
        const room = this._room;
        const powerLevelsObservable = await this._room.observePowerLevels();
        return {members, powerLevelsObservable, mediaRepository: room.mediaRepository};
    }

    _setupNavigation() {
        this._hookUpdaterToSegment("details", RoomDetailsViewModel, () => { return {room: this._room}; });
        this._hookUpdaterToSegment("members", MemberListViewModel, () => this._getMemberArguments());
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
