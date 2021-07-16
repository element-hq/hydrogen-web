import {LazyListView} from "../../general/LazyListView.js";
import {MemberTileView} from "./MemberTileView.js";

export class MemberListView extends LazyListView{
    constructor(vm) {
        super({
            list: vm.memberTileViewModels,
            className: "MemberListView",
            itemHeight: 40
        }, tileViewModel => new MemberTileView(tileViewModel));
    }
}
