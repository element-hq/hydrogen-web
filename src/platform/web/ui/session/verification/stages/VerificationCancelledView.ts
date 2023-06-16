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
import {VerificationCancelledViewModel} from "../../../../../../domain/session/verification/stages/VerificationCancelledViewModel";

export class VerificationCancelledView extends TemplateView<VerificationCancelledViewModel> {
    render(t: Builder<VerificationCancelledViewModel>, vm: VerificationCancelledViewModel) {
        return t.div(
            {
                className: "VerificationCancelledView",
            },
            [
                t.h2(
                    { className: "VerificationCancelledView__title" },
                    vm.title,
                ),
                t.p(
                    { className: "VerificationCancelledView__description" },
                   vm.description,
                ),
                t.div({ className: "VerificationCancelledView__actions" }, [
                    t.button({
                        className: {
                            "button-action": true,
                            "primary": true,
                        },
                        onclick: () => vm.dismiss(),
                    }, "Got it")
                ]),
            ]
        );
    }
}
