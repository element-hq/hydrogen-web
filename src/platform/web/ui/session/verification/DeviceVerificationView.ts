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

import {TemplateView} from "../../general/TemplateView";
import {WaitingForOtherUserViewModel} from "../../../../../domain/session/verification/stages/WaitingForOtherUserViewModel";
import {DeviceVerificationViewModel} from "../../../../../domain/session/verification/DeviceVerificationViewModel";
import {VerificationCancelledViewModel} from "../../../../../domain/session/verification/stages/VerificationCancelledViewModel";
import {WaitingForOtherUserView} from "./stages/WaitingForOtherUserView";
import {VerificationCancelledView} from "./stages/VerificationCancelledView";
import {SelectMethodViewModel} from "../../../../../domain/session/verification/stages/SelectMethodViewModel";
import {SelectMethodView} from "./stages/SelectMethodView";
import {VerifyEmojisViewModel} from "../../../../../domain/session/verification/stages/VerifyEmojisViewModel";
import {VerifyEmojisView} from "./stages/VerifyEmojisView";
import {VerificationCompleteViewModel} from "../../../../../domain/session/verification/stages/VerificationCompleteViewModel";
import {VerificationCompleteView} from "./stages/VerificationCompleteView";

export class DeviceVerificationView extends TemplateView<DeviceVerificationViewModel> {
    render(t, vm) {
        return t.div({
            className: {
                "middle": true,
                "DeviceVerificationView": true,
            }
        }, [
            t.mapView(vm => vm.currentStageViewModel, (stageVm) => {
                if (stageVm instanceof WaitingForOtherUserViewModel) {
                    return new WaitingForOtherUserView(stageVm);
                }
                else if (stageVm instanceof VerificationCancelledViewModel) {
                    return new VerificationCancelledView(stageVm);
                }
                else if (stageVm instanceof SelectMethodViewModel) {
                    return new SelectMethodView(stageVm);
                }
                else if (stageVm instanceof VerifyEmojisViewModel) {
                    return new VerifyEmojisView(stageVm);
                }
                else if (stageVm instanceof VerificationCompleteViewModel) {
                    return new VerificationCompleteView(stageVm);
                }
            })
        ])
    }
}
