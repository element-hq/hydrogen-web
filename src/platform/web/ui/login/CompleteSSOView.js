/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../general/TemplateView";
import {SessionLoadStatusView} from "./SessionLoadStatusView.js";

export class CompleteSSOView extends TemplateView {
    render(t) {
        return t.div({ className: "CompleteSSOView" },
            [
                t.p({ className: "CompleteSSOView_title" }, "Finishing up your SSO Login"),
                t.if(vm => vm.errorMessage, (t, vm) => t.p({className: "error"}, vm.i18n(vm.errorMessage))),
                t.mapView(vm => vm.loadViewModel, loadViewModel => loadViewModel ? new SessionLoadStatusView(loadViewModel) : null),
            ]
        );
    }
}
