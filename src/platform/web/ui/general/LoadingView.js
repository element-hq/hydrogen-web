/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {StaticView} from "./StaticView";
import {spinner} from "../common.js";

export class LoadingView extends StaticView {
    constructor(label = "Loading") {
        super(label, (t, label) => {
            return t.div({ className: "LoadingView" }, [spinner(t), label]);
        });
    }
}
