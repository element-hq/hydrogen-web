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

import {AvatarView} from "../../AvatarView.js";
import {classNames} from "../../general/html.js";
import {TemplateView} from "../../general/TemplateView.js";

export class MemberDetailsView extends TemplateView {
    render(t, vm) {
        return t.div({className: "MemberDetailsView"},
            [   t.view(new AvatarView(vm, 128)),
                t.div({className: "MemberDetailsView_name"}, [t.h2(vm.name)]),
                t.div({ className: "MemberDetailsView_id" }, vm.userId),
                this._createSection(t, "ROLE", {}, vm.role)
            ]);
    }

    _createSection(t, label, labelClass, value) {
        const labelClassString = classNames({MemberDetailsView_label: true, ...labelClass});
        return t.div({className: "MemberDetailsView_section"}, [
            t.div({className: labelClassString}, [label]),
            t.div({className: "MemberDetailsView_value"}, value)
        ]);
    }
}
