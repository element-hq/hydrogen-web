/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {Builder, TemplateView} from "../../../general/TemplateView";
import {spinner} from "../../../common.js"
import type {SelectMethodViewModel} from "../../../../../../domain/session/verification/stages/SelectMethodViewModel";

export class SelectMethodView extends TemplateView<SelectMethodViewModel> {
    render(t: Builder<SelectMethodViewModel>) {
        return t.div({ className: "SelectMethodView" }, [
            t.map(vm => vm.hasProceeded, (hasProceeded, t, vm) => {
                if (hasProceeded) {
                    return spinner(t);
                }
                else return t.div([
                    t.div({ className: "SelectMethodView__heading" }, [
                        t.h2( { className: "SelectMethodView__title" }, this.getHeading(t, vm)),
                    ]),
                    t.p({ className: "SelectMethodView__description" }, this.getSubheading(vm)),
                    t.div({ className: "SelectMethodView__actions" }, [
                        t.button(
                            {
                                className: {
                                    "button-action": true,
                                    primary: true,
                                    destructive: true,
                                },
                                onclick: () => vm.cancel(),
                            },
                            "Cancel"
                        ),
                        t.button(
                            {
                                className: {
                                    "button-action": true,
                                    primary: true,
                                },
                                onclick: () => vm.proceed(),
                            },
                            "Proceed"
                        ),
                    ]),
                ]);
            }),
        ]);
    }

    getHeading(t: Builder<SelectMethodViewModel>, vm: SelectMethodViewModel) {
        if (vm.isCrossSigningAnotherUser) {
            return [vm.i18n`Verify user `, t.span({
                 className: "SelectMethodView__name"
                }, vm.otherUserId), vm.i18n` by comparing emojis?`];
        } else {
            return [vm.i18n`Verify device`, t.span({
                 className: "SelectMethodView__name"
                }, vm.deviceName), vm.i18n` by comparing emojis?`];
        }
    }

    getSubheading(vm: SelectMethodViewModel): string {
        if (vm.isCrossSigningAnotherUser) {
            return vm.i18n`You are about to verify user (${vm.otherUserId}) by comparing emojis.`;
        } else {
            return vm.i18n`You are about to verify your other device (${vm.deviceName}) by comparing emojis.`;
        }
    }
}
