/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseMessageView} from "./BaseMessageView.js";
import {Menu} from "../../../general/Menu.js";

export class RedactedView extends BaseMessageView {
    renderMessageBody(t) {
        return t.p({className: "Timeline_messageBody statusMessage"}, vm => vm.description);
    }

    createMenuOptions(vm) {
        const options = super.createMenuOptions(vm);
        if (vm.isRedacting) {
            options.push(Menu.option(vm.i18n`Cancel`, () => vm.abortPendingRedaction()));
        }
        return options;
    }
}