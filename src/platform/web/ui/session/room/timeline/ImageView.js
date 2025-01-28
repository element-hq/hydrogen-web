/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseMediaView} from "./BaseMediaView.js";

export class ImageView extends BaseMediaView {
    renderMedia(t, vm) {
        const img = t.img({
            src: vm => vm.thumbnailUrl,
            alt: vm => vm.label,
            title: vm => vm.label,
            style: `max-width: ${vm.width}px; max-height: ${vm.height}px;`
        });
        return vm.isPending || !vm.lightboxUrl ? img : t.a({href: vm.lightboxUrl}, img);
    }
}
