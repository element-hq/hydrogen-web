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
import {TemplateView} from "../../general/TemplateView";

export class MemberDetailsView extends TemplateView {
    render(t, vm) {
        return t.div({className: "MemberDetailsView"},
            [   t.view(new AvatarView(vm, 128)),
                t.div({className: "MemberDetailsView_name"}, t.h2(vm => vm.name)),
                t.div({className: "MemberDetailsView_id"}, vm.userId),
                this._createSection(t, vm.i18n`Role`, vm => vm.role),
                this._createSection(t, vm.i18n`Security`, vm.isEncrypted ?
                    vm.i18n`Messages in this room are end-to-end encrypted.` :
                    vm.i18n`Messages in this room are not end-to-end encrypted.`
                ),
                this._createOptions(t, vm)
            ]);
    }

    _createSection(t, label, value) {
        return t.div({ className: "MemberDetailsView_section" },
            [
                t.div({className: "MemberDetailsView_label"}, label),
                t.div({className: "MemberDetailsView_value"}, value)
            ]);
    }

    _createOptions(t, vm) {
        return t.div({ className: "MemberDetailsView_section" },
            [
                t.div({className: "MemberDetailsView_label"}, vm.i18n`Options`),
                t.div({className: "MemberDetailsView_options"},
                    [
                        t.a({href: vm.linkToUser, target: "_blank", rel: "noopener"}, vm.i18n`Open Link to User`)
                    ])
            ]);
    }
}
