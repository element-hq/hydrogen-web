/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../../general/TemplateView";

export class DisabledComposerView extends TemplateView {
    render(t) {
        return t.div({className: "DisabledComposerView"}, t.h3(vm => vm.description));
    }
}
