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

