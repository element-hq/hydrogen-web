/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {LeftPanelView} from "./leftpanel/LeftPanelView.js";
import {RoomView} from "./room/RoomView.js";
import {UnknownRoomView} from "./room/UnknownRoomView.js";
import {RoomBeingCreatedView} from "./room/RoomBeingCreatedView.js";
import {InviteView} from "./room/InviteView.js";
import {LightboxView} from "./room/LightboxView.js";
import {TemplateView} from "../general/TemplateView";
import {StaticView} from "../general/StaticView.js";
import {SessionStatusView} from "./SessionStatusView.js";
import {RoomGridView} from "./RoomGridView.js";
import {SettingsView} from "./settings/SettingsView.js";
import {CreateRoomView} from "./CreateRoomView.js";
import {RightPanelView} from "./rightpanel/RightPanelView.js";
import {viewClassForTile} from "./room/common";
import {JoinRoomView} from "./JoinRoomView";
import {DeviceVerificationView} from "./verification/DeviceVerificationView";
import {ToastCollectionView} from "./toast/ToastCollectionView";

export class SessionView extends TemplateView {
    render(t, vm) {
        return t.div({
            className: {
                "SessionView": true,
                "middle-shown": vm => !!vm.activeMiddleViewModel,
                "right-shown": vm => !!vm.rightPanelViewModel
            },
        }, [
            t.view(new ToastCollectionView(vm.toastCollectionViewModel)),
            t.view(new SessionStatusView(vm.sessionStatusViewModel)),
            t.view(new LeftPanelView(vm.leftPanelViewModel)),
            t.mapView(vm => vm.activeMiddleViewModel, () => {
                if (vm.roomGridViewModel) {
                    return new RoomGridView(vm.roomGridViewModel, viewClassForTile);
                } else if (vm.settingsViewModel) {
                    return new SettingsView(vm.settingsViewModel);
                } else if (vm.createRoomViewModel) {
                    return new CreateRoomView(vm.createRoomViewModel);
                } else if (vm.joinRoomViewModel) {
                    return new JoinRoomView(vm.joinRoomViewModel);
                } else if (vm.verificationViewModel) {
                    return new DeviceVerificationView(vm.verificationViewModel);
                } else if (vm.currentRoomViewModel) {
                    if (vm.currentRoomViewModel.kind === "invite") {
                        return new InviteView(vm.currentRoomViewModel);
                    } else if (vm.currentRoomViewModel.kind === "room") {
                        return new RoomView(vm.currentRoomViewModel, viewClassForTile);
                    } else if (vm.currentRoomViewModel.kind === "roomBeingCreated") {
                        return new RoomBeingCreatedView(vm.currentRoomViewModel);
                    } else {
                        return new UnknownRoomView(vm.currentRoomViewModel);
                    }
                } else {
                    return new StaticView(t => t.div({className: "room-placeholder"}, t.h2(vm.i18n`Choose a room on the left side.`)));
                }
            }),
            t.mapView(vm => vm.lightboxViewModel, lightboxViewModel => lightboxViewModel ? new LightboxView(lightboxViewModel) : null),
            t.mapView(vm => vm.rightPanelViewModel, rightPanelViewModel => rightPanelViewModel ? new RightPanelView(rightPanelViewModel) : null)
        ]);
    }
}
