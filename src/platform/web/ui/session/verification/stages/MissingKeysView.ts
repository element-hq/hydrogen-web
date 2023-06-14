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
import type {MissingKeysViewModel} from "../../../../../../domain/session/verification/stages/MissingKeysViewModel";

export class MissingKeysView extends TemplateView<MissingKeysViewModel> {
    render(t: Builder<MissingKeysViewModel>, vm: MissingKeysViewModel) {
        return t.div(
            {
                className: "MissingKeysView",
            },
            [
                t.h2(
                    { className: "MissingKeysView__heading" },
                    vm.i18n`Verification is currently not possible!`
                ),
                t.p(
                    { className: "MissingKeysView__description" },
                   vm.i18n`Some keys needed for verification are missing. You can fix this by enabling key backup in settings.` 
                ),
                t.div({ className: "MissingKeysView__actions" }, [
                    t.button({
                        className: {
                            "button-action": true,
                            "primary": true,
                        },
                        onclick: () => vm.gotoSettings(),
                    }, "Open Settings")
                ]),
            ]
        );
    }
}
