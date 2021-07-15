import {TemplateView} from "../../general/TemplateView.js";
import {RoomDetailsView} from "./RoomDetailsView.js";
import {MemberListView} from "./MemberListView.js";
import {LoadingView} from "./LoadingView.js";

export class RightPanelView extends TemplateView {
    render(t) {
        const viewFromType = {
            "room-details": RoomDetailsView,
            "member-list": MemberListView
        };
        return t.div({ className: "RightPanelView" },
            [
                t.mapView(vm => vm.activeViewModel && vm, vm => vm ? new ButtonsView(vm) : null),
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
