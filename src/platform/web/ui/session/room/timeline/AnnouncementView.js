/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../../../general/TemplateView";

export class AnnouncementView extends TemplateView {
    // ignore other arguments
    constructor(vm) {
        super(vm);
    }

    render(t, vm) {
        return t.li({
            className: "AnnouncementView",
            'data-event-id': vm.eventId
        }, t.div(vm => vm.announcement));
    }
    
    /* This is called by the parent ListView, which just has 1 listener for the whole list */
    onClick() {}
}
