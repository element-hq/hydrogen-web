import {ViewModel} from "../../ViewModel.js";
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
        }
        const updater = (vm, params, newMember) => {
            vm.updateFrom(newMember);
            this.nameDisambiguator.disambiguate(vm);
        };
        return members.mapValues(mapper, updater);
    }

}
