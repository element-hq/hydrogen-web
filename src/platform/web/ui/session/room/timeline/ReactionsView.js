/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ListView} from "../../../general/ListView";
import {TemplateView} from "../../../general/TemplateView";

export class ReactionsView extends ListView {
    constructor(reactionsViewModel) {
        const options = {
            className: "Timeline_messageReactions",
            tagName: "div",
            list: reactionsViewModel.reactions,
            onItemClick: reactionView => reactionView.onClick(),
        }
        super(options, reactionVM => new ReactionView(reactionVM));
    }
}

class ReactionView extends TemplateView {
    render(t, vm) {
        return t.button({
            className: {
                active: vm => vm.isActive,
                pending: vm => vm.isPending
            },
        }, [vm.key, " ", vm => `${vm.count}`]);
    }

    onClick() {
        this.value.toggle();
    }
}
