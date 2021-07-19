import {TemplateView} from "../../general/TemplateView.js";
import {RoomDetailsView} from "./RoomDetailsView.js";
import {MemberListView} from "./MemberListView.js";
import {LoadingView} from "../../general/LoadingView.js";
import {MemberDetailsView} from "./MemberDetailsView.js";

export class RightPanelView extends TemplateView {
    render(t) {
        const viewFromType = {
            "room-details": RoomDetailsView,
            "member-list": MemberListView,
            "member-details": MemberDetailsView
        };
        return t.div({ className: "RightPanelView" },
            [
                t.ifView(vm => vm.activeViewModel, vm => new ButtonsView(vm)),
                t.mapView(vm => vm.activeViewModel, vm => vm ? new viewFromType[vm.type](vm) : new LoadingView())
            ]
        );
    }
}

class ButtonsView extends TemplateView {
    render(t, vm) {
        return t.div({ className: "RightPanelView_buttons" },
            [
            t.button({
                className: {
                    "back": true,
                    "button-utility": true,
                    "hide": !vm.activeViewModel.shouldShowBackButton
                }, onClick: () => vm.showPreviousPanel()}),
            t.button({className: "close button-utility", onClick: () => vm.closePanel()})
        ]);
    }
}
