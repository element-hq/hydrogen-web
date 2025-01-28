/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
