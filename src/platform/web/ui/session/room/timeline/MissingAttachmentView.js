/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseMessageView} from "./BaseMessageView.js";

export class MissingAttachmentView extends BaseMessageView {
    renderMessageBody(t, vm) {
        return t.p({className: "Timeline_messageBody statusMessage"}, vm.label);
    }
}
