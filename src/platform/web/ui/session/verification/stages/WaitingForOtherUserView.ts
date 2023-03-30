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
import {spinner} from "../../../common.js";
import {WaitingForOtherUserViewModel} from "../../../../../../domain/session/verification/stages/WaitingForOtherUserViewModel";

export class WaitingForOtherUserView extends TemplateView<WaitingForOtherUserViewModel> {
    render(t: Builder<WaitingForOtherUserViewModel>, vm: WaitingForOtherUserViewModel) {
        return t.div({ className: "WaitingForOtherUserView" }, [
            t.div({ className: "WaitingForOtherUserView__heading" }, [
                spinner(t),
                t.h2(
                    { className: "WaitingForOtherUserView__title" },
                    vm.i18n`Waiting for any of your device to accept the verification request`
                ),
            ]),
            t.p({ className: "WaitingForOtherUserView__description" },
                vm.i18n`Accept the request from the device you wish to verify!`
            ),
            t.div({ className: "WaitingForOtherUserView__actions" },
                t.button({
                    className: {
                        "button-action": true,
                        "primary": true,
                        "destructive": true,
                    },
                    onclick: () => vm.cancel(),
                }, "Cancel")
            ),
        ]);
    }
}
