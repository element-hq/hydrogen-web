/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseMessageView} from "./BaseMessageView.js";

export class FileView extends BaseMessageView {
    renderMessageBody(t, vm) {
        const children = [];
        if (vm.isPending) {
            children.push(vm => vm.label);
        } else {
            children.push(
                t.button({className: "link", onClick: () => vm.download()}, vm => vm.label),
                t.time(vm.time)
            );
        }
        return t.p({className: "Timeline_messageBody statusMessage"}, children);
    }
}
