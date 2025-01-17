/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseMessageView} from "./BaseMessageView.js";

export class LocationView extends BaseMessageView {
    renderMessageBody(t, vm) {
        return t.p({className: "Timeline_messageBody statusMessage"}, [
            t.span(vm.label),
            t.a({className: "Timeline_locationLink", href: vm.mapsLink, target: "_blank", rel: "noopener"}, vm.i18n`Open in maps`),
            t.time(vm.time)
        ]);
    }
}
