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
import type {Options as BaseOptions} from "../../ViewModel";
import {MemberTileViewModel} from "./MemberTileViewModel";
import {createMemberComparator} from "./members/comparator";
import {Disambiguator} from "./members/disambiguator";
import type {RetainedObservableValue} from "../../../observable/ObservableValue";
import type {PowerLevels} from "../../../matrix/room/PowerLevels";
import type {MemberList} from "../../../matrix/room/members/MemberList";
import type {MediaRepository} from "../../../matrix/net/MediaRepository";
import type {MappedMap} from "../../../observable/map/MappedMap";
import type {ObservableMap, Mapper, Updater} from "../../../observable/map";
import type {RoomMember} from "../../../matrix/room/members/RoomMember";

export type ExplicitOptions = {
    members: MemberList,
    powerLevelsObservable: RetainedObservableValue<PowerLevels>,
    mediaRepository: MediaRepository
};

type Options = BaseOptions & ExplicitOptions;

export class MemberListViewModel extends ViewModel {
    memberTileViewModels: MappedMap<string, RoomMember, MemberTileViewModel>;
    nameDisambiguator: Disambiguator;
    mediaRepository: MediaRepository;

    constructor(options: Options) {
        super(options);
        const list = options.members;

        const powerLevelsObservable = options.powerLevelsObservable;
        this.track(powerLevelsObservable.subscribe(() => { /*resort based on new power levels here*/ }));

        const powerLevels = powerLevelsObservable.get();
        this.memberTileViewModels = this._mapTileViewModels(
            list.members.filterValues((member) => member.membership === "join")
        ).sortValues(createMemberComparator(powerLevels));
        this.nameDisambiguator = new Disambiguator();
        this.mediaRepository = options.mediaRepository;
    }

    get type(): string { return "member-list"; }

    get shouldShowBackButton(): boolean { return true; }

    get previousSegmentName(): string { return "details"; }

    _mapTileViewModels(
        members: ObservableMap<string, RoomMember>
    ): MappedMap<string, RoomMember, MemberTileViewModel> {
        const mapper: Mapper<RoomMember, MemberTileViewModel> = (
            member: RoomMember,
            emitChange: any
        ): MemberTileViewModel => {
            const mediaRepository = this.mediaRepository;
            const vm = new MemberTileViewModel(
                this.childOptions({ member, emitChange, mediaRepository })
            );
            this.nameDisambiguator.disambiguate(vm);
            return vm;
        };
        const updater: Updater<RoomMember, MemberTileViewModel> = (
            params,
            vm: MemberTileViewModel,
            newMember: RoomMember
        ): void => {
            vm.updateFrom(newMember);
            this.nameDisambiguator.disambiguate(vm);
        };
        return members.mapValues(mapper, updater);
    }

}
