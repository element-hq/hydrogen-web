/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseMediaTile} from "./BaseMediaTile.js";

export class ImageTile extends BaseMediaTile {
    constructor(entry, options) {
        super(entry, options);
        this._lightboxUrl = this.urlRouter.urlForSegments([
            // ensure the right room is active if in grid view
            this.navigation.segment("room", this._room.id),
            this.navigation.segment("lightbox", this._entry.id)
        ]);
    }

    get lightboxUrl() {
        if (!this.isPending) {
            return this._lightboxUrl;
        }
        return "";
    }

    get shape() {
        return "image";
    }
}
