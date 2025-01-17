/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {Builder, InlineTemplateView, TemplateView} from "../../general/TemplateView";
import {DeviceVerificationViewModel} from "../../../../../domain/session/verification/DeviceVerificationViewModel";
import {WaitingForOtherUserView} from "./stages/WaitingForOtherUserView";
import {VerificationCancelledView} from "./stages/VerificationCancelledView";
import {SelectMethodView} from "./stages/SelectMethodView";
import {VerifyEmojisView} from "./stages/VerifyEmojisView";
import {VerificationCompleteView} from "./stages/VerificationCompleteView";
import {MissingKeysView} from "./stages/MissingKeysView";
import {spinner} from "../../common.js";

export class DeviceVerificationView extends TemplateView<DeviceVerificationViewModel> {
    render(t: Builder<DeviceVerificationViewModel>, vm: DeviceVerificationViewModel) {
        return t.div({
            className: {
                "middle": !vm.isHappeningInRoom,
                "DeviceVerificationView": true,
            }
        }, [
            t.mapView(vm => vm.currentStageViewModel, (vm) => {
                switch (vm?.kind) {
                    case "waiting-for-user": return new WaitingForOtherUserView(vm);
                    case "verification-cancelled": return new VerificationCancelledView(vm);
                    case "select-method": return new SelectMethodView(vm);
                    case "verify-emojis": return new VerifyEmojisView(vm);
                    case "verification-completed": return new VerificationCompleteView(vm);
                    case "keys-missing": return new MissingKeysView(vm);
                    default: return new InlineTemplateView(vm, () => spinner(t));
                }
            })
        ])
    }
}
