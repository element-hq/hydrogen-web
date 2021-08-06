/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {TemplateView} from "../../general/TemplateView.js";
import {AvatarView} from "../../AvatarView.js";

export class MemberTileView extends TemplateView {
    render(t, vm) {
        return t.li({ className: "MemberTileView" },
            t.a({ href: vm.detailsUrl },
            [
                t.view(new AvatarView(vm, 32)),
                t.div({ className: "MemberTileView_name" }, (vm) => vm.name),
            ])
        );
    }
}
