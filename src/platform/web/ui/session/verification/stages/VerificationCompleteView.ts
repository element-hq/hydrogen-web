/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import {Builder, TemplateView} from "../../../general/TemplateView";
import type {VerificationCompleteViewModel} from "../../../../../../domain/session/verification/stages/VerificationCompleteViewModel";

export class VerificationCompleteView extends TemplateView<VerificationCompleteViewModel> {
    render(t: Builder<VerificationCompleteViewModel>, vm: VerificationCompleteViewModel) {
        return t.div({ className: "VerificationCompleteView" }, [
            t.div({className: "VerificationCompleteView__icon"}),
            t.div({ className: "VerificationCompleteView__heading" }, [
                t.h2(
                    { className: "VerificationCompleteView__title" },
                    vm.i18n`Verification completed successfully!`
                ),
            ]),
            t.p(
                { className: "VerificationCompleteView__description" },
                vm.i18n`You successfully verified device ${vm.otherDeviceId}`
            ),
            t.div({ className: "VerificationCompleteView__actions" }, [
                t.button({
                    className: {
                        "button-action": true,
                        "primary": true,
                    },
                    onclick: () => vm.gotoSettings(),
                }, "Got it")
            ]),
        ]);
    }
}
