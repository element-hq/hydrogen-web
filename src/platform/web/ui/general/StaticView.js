/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {tag} from "../general/html";

export class StaticView {
    constructor(value, render = undefined) {
        if (typeof value === "function" && !render) {
            render = value;
            value = null;
        }
        this._root = render ? render(tag, value) : this.render(tag, value);
    }

    mount() {
        return this._root;
    }

    root() {
        return this._root;
    }

    unmount() {}
    update() {}
}
