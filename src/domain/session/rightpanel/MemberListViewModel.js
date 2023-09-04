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

import {ViewModel} from "../../ViewModel";
import {MemberTileViewModel} from "./MemberTileViewModel.js";
import {createMemberComparator} from "./members/comparator.js";
import {Disambiguator} from "./members/disambiguator.js";

export class MemberListViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const list = options.members;

        const powerLevelsObservable = options.powerLevelsObservable;
        this.track(powerLevelsObservable.subscribe(() => { /*resort based on new power levels here*/ }));

        const powerLevels = powerLevelsObservable.get();
        this.memberTileViewModels = this._mapTileViewModels(list.members.filterValues(member => member.membership === "join"))
                                        .sortValues(createMemberComparator(powerLevels));
        this.nameDisambiguator = new Disambiguator();
        this.mediaRepository = options.mediaRepository;
    }

    get type() { return "member-list"; }

    get shouldShowBackButton() { return true; }

    get previousSegmentName() { return "details"; }

    _mapTileViewModels(members) {
        const mapper = (member, emitChange) => {
            const mediaRepository = this.mediaRepository;
            const vm = new MemberTileViewModel(this.childOptions({member, emitChange, mediaRepository}));
            this.nameDisambiguator.disambiguate(vm);
            return vm;
        };
        const updater = (params, vm, newMember) => {
            vm.updateFrom(newMember);
            this.nameDisambiguator.disambiguate(vm);
        };
        return members.mapValues(mapper, updater);
    }

    openInvitePanel() {
        let path = this.navigation.path.until("room");
        path = path.with(this.navigation.segment("right-panel", true));
        path = path.with(this.navigation.segment("invite", true));
        this.navigation.applyPath(path);
    }

}
