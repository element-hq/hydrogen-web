/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView, Builder} from "./TemplateView";
import { disableTargetCallback } from "./utils";

import type { ViewNode } from "./types";
import type {ErrorViewModel} from "../../../../domain/ErrorViewModel";


export class ErrorView extends TemplateView<ErrorViewModel> {
    constructor(vm: ErrorViewModel, private readonly options: {inline: boolean} = {inline: false}) {
        super(vm);
    }
    override render(t: Builder<ErrorViewModel>, vm: ErrorViewModel): ViewNode {
        const submitLogsButton = t.button({
            className: "ErrorView_submit",
            onClick: disableTargetCallback(async evt => {
                evt.stopPropagation();
                if (await vm.submitLogs()) {
                    alert("Logs submitted!");
                } else {
                    alert("Could not submit logs");
                }
            })
        }, "Submit logs");
        const closeButton = t.button({
            className: "ErrorView_close",
            onClick: evt => {
                evt.stopPropagation();
                vm.close();
            },
            title: "Dismiss error"
        });
        return t.div({
            className: {
                "ErrorView": true,
                "ErrorView_inline": this.options.inline,
                "ErrorView_block": !this.options.inline
            }}, [
            t.p({className: "ErrorView_message"}, vm.message),
            submitLogsButton,
            closeButton
        ]);
    }
}

