/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../../general/TemplateView";
import {RoomDetailsView} from "./RoomDetailsView.js";
import {MemberListView} from "./MemberListView.js";
import {LoadingView} from "../../general/LoadingView.js";
import {MemberDetailsView} from "./MemberDetailsView.js";
import {DeviceVerificationView} from "../verification/DeviceVerificationView";
import {InvitePanelView} from "./InvitePanelView";

export class RightPanelView extends TemplateView {
    render(t) {
        return t.div({ className: "RightPanelView" },
            [
                t.ifView(vm => vm.activeViewModel, vm => new ButtonsView(vm)),
                t.mapView(vm => vm.activeViewModel, vm => this._viewFromType(vm))
            ]
        );
    }

    _viewFromType(vm) {
        const type = vm?.type;
        switch (type) {
            case "room-details":
                return new RoomDetailsView(vm);
            case "member-list":
                return new MemberListView(vm);
            case "member-details":
                return new MemberDetailsView(vm);
            case "invite":
                return new InvitePanelView(vm);
            case "verification":
                return new DeviceVerificationView(vm);
            default:
                return new LoadingView();
        }
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
                    "hide": (vm) => !vm.activeViewModel.shouldShowBackButton
                }, onClick: () => vm.showPreviousPanel()}),
            t.button({className: "close button-utility", onClick: () => vm.closePanel()})
        ]);
    }
}
