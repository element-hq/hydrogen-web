/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../../general/TemplateView";
import {AvatarView} from "../../AvatarView.js";

export class MemberTileView extends TemplateView {
    render(t, vm) {
        return t.li({ className: "MemberTileView" },
            t.a({ href: vm.detailsUrl },
            [
                t.view(new AvatarView(vm, 32)),
                t.div({ className: "MemberTileView_name" }, (vm) => vm.name),
            ])
        );
    }
}
