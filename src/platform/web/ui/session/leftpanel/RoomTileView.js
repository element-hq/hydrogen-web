/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {TemplateView} from "../../general/TemplateView";
import {AvatarView} from "../../AvatarView.js";
import {spinner} from "../../common.js";

export class RoomTileView extends TemplateView {
    render(t, vm) {
        const classes = {
            "active": vm => vm.isOpen,
            "hidden": vm => vm.hidden
        };
        return t.li({"className": classes}, [
            t.a({href: vm.url}, [
                t.view(new AvatarView(vm, 32), {parentProvidesUpdates: true}),
                t.div({className: "description"}, [
                    t.div({className: {"name": true, unread: vm => vm.isUnread}}, vm => vm.name),
                    t.map(vm => vm.busy, busy => {
                        if (busy) {
                            return spinner(t);
                        } else {
                            return t.div({
                                className: {
                                    badge: true,
                                    highlighted: vm => vm.isHighlighted,
                                    hidden: vm => !vm.badgeCount
                                }
                            }, vm => vm.badgeCount);
                        }
                    })
                ])
            ])
        ]);
    }

    update(value, props) {
        super.update(value);
        // update the AvatarView as we told it to not subscribe itself with parentProvidesUpdates
        this.updateSubViews(value, props);
    }
}
