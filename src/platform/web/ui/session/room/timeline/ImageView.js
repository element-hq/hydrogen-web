/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {TemplateView} from "../../../general/TemplateView.js";
import {renderMessage} from "./common.js";

export class ImageView extends TemplateView {
    render(t, vm) {
        const heightRatioPercent = (vm.thumbnailHeight / vm.thumbnailWidth) * 100; 
        let spacerStyle = `padding-top: ${heightRatioPercent}%;`;
        if (vm.platform.isIE11) {
            // preserving aspect-ratio in a grid with padding percentages
            // does not work in IE11, so we assume people won't use it
            // with viewports narrower than 400px where thumbnails will get
            // scaled. If they do, the thumbnail will still scale, but
            // there will be whitespace underneath the picture
            // An alternative would be to use position: absolute but that
            // can slow down rendering, and was bleeding through the lightbox.
            spacerStyle = `height: ${vm.thumbnailHeight}px`;
        }
        const img = t.img({
            loading: "lazy",
            src: vm => vm.thumbnailUrl,
            alt: vm => vm.label,
            title: vm => vm.label,
            style: `max-width: ${vm.thumbnailWidth}px; max-height: ${vm.thumbnailHeight}px;`
        });
        const children = [
            t.div({className: "spacer", style: spacerStyle}),
            vm.isPending ? img : t.a({href: vm.lightboxUrl}, img),
            t.time(vm.date + " " + vm.time),
        ];
        if (vm.isPending) {
            const cancel = t.button({onClick: () => vm.abortSending(), className: "link"}, vm.i18n`Cancel`);
            const sendStatus = t.div({
                className: {
                    sendStatus: true,
                    hidden: vm => !vm.sendStatus
                },
            }, [vm => vm.sendStatus, " ", cancel]);
            const progress = t.progress({
                min: 0,
                max: 100,
                value: vm => vm.uploadPercentage,
                className: {hidden: vm => !vm.isUploading}
            });
            children.push(sendStatus, progress);
        }
        return renderMessage(t, vm, [
            t.div({className: "picture", style: `max-width: ${vm.thumbnailWidth}px`}, children),
            t.if(vm => vm.error, t.createTemplate((t, vm) => t.p({className: "error"}, vm.error)))
        ]);
    }
}
