/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../../../general/TemplateView";
import {spinner} from "../../../common.js";
import {ErrorView} from "../../../general/ErrorView";

export class GapView extends TemplateView {
    // ignore other argument
    constructor(vm) {
        super(vm);
    }

    render(t, vm) {
        const className = {
            GapView: true,
            isLoading: vm => vm.isLoading,
            isAtTop: vm => vm.isAtTop,
        };
        return t.li({ className }, [
            t.div({class: "GapView_container"}, [
                t.if(vm => vm.showSpinner, (t) => spinner(t)),
                t.span(vm => vm.status),
            ]),
            t.if(vm => !!vm.errorViewModel, t => {
                return t.view(new ErrorView(vm.errorViewModel, {inline: true}));
            })
        ]);
    }

    /* This is called by the parent ListView, which just has 1 listener for the whole list */
    onClick() {}
}
