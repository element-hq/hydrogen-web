/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseMessageView} from "./BaseMessageView.js";
import {Menu} from "../../../general/Menu.js";

export class BaseMediaView extends BaseMessageView {
    renderMessageBody(t, vm) {
        const heightRatioPercent = (vm.height / vm.width) * 100; 
        let spacerStyle = `padding-top: ${heightRatioPercent}%;`;
        if (vm.platform.isIE11) {
            // preserving aspect-ratio in a grid with padding percentages
            // does not work in IE11, so we assume people won't use it
            // with viewports narrower than 400px where thumbnails will get
            // scaled. If they do, the thumbnail will still scale, but
            // there will be whitespace underneath the picture
            // An alternative would be to use position: absolute but that
            // can slow down rendering, and was bleeding through the lightbox.
            spacerStyle = `height: ${vm.height}px`;
        }
        const children = [
            t.div({className: "spacer", style: spacerStyle}),
            this.renderMedia(t, vm),
            t.time(vm.time),
        ];
        const status = t.div({
            className: {
                status: true,
                hidden: vm => !vm.status
            },
        }, vm => vm.status);
        children.push(status);
        if (vm.isPending) {
            const progress = t.progress({
                min: 0,
                max: 100,
                value: vm => vm.uploadPercentage,
                className: {hidden: vm => !vm.isUploading}
            });
            children.push(progress);
        }
        return t.div({className: "Timeline_messageBody"}, [
            t.div({className: "media", style: `max-width: ${vm.width}px`, "data-testid": "media"}, children),
            t.if(vm => vm.error, t => t.p({className: "error"}, vm.error))
        ]);
    }

    createMenuOptions(vm) {
        const options = super.createMenuOptions(vm);
        if (!vm.isPending) {
            let label;
            switch (vm.shape) {
                case "image": label = vm.i18n`Download image`; break;
                case "video": label = vm.i18n`Download video`; break;
                default: label = vm.i18n`Download media`; break;
            }
            options.push(Menu.option(label, () => vm.downloadMedia()));
        }
        return options;
    }
}
