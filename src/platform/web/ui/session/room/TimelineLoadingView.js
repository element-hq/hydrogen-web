/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../../general/TemplateView";
import {spinner} from "../../common.js";

export class TimelineLoadingView extends TemplateView {
    render(t, vm) {
        return t.div({className: "TimelineLoadingView"}, [
            spinner(t),
            t.div(vm.isEncrypted ? vm.i18n`Loading encrypted messages…` : vm.i18n`Loading messages…`)
        ]);
    }
}
