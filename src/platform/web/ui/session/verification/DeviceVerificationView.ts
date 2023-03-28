/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import {Builder, TemplateView} from "../../general/TemplateView";
import {DeviceVerificationViewModel} from "../../../../../domain/session/verification/DeviceVerificationViewModel";
import {WaitingForOtherUserView} from "./stages/WaitingForOtherUserView";
import {VerificationCancelledView} from "./stages/VerificationCancelledView";
import {SelectMethodView} from "./stages/SelectMethodView";
import {VerifyEmojisView} from "./stages/VerifyEmojisView";
import {VerificationCompleteView} from "./stages/VerificationCompleteView";

export class DeviceVerificationView extends TemplateView<DeviceVerificationViewModel> {
    render(t: Builder<DeviceVerificationViewModel>) {
        return t.div({
            className: {
                "middle": true,
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
                    default: return null;
                }
            })
        ])
    }
}
